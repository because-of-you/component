package casdoor_enforcer

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const maxResponseBodyBytes = 1 << 20

type Config struct {
	Endpoint        string `json:"endpoint,omitempty"`
	PermissionID    string `json:"permissionId,omitempty"`
	ClientID        string `json:"clientId,omitempty"`
	ClientSecretEnv string `json:"clientSecretEnv,omitempty"`
	SubjectHeader   string `json:"subjectHeader,omitempty"`
	Timeout         string `json:"timeout,omitempty"`
}

func CreateConfig() *Config {
	return &Config{
		ClientSecretEnv: "CASDOOR_ENFORCER_CLIENT_SECRET",
		SubjectHeader:   "X-Casdoor-Subject",
		Timeout:         "2s",
	}
}

type enforcer struct {
	next          http.Handler
	endpoint      *url.URL
	permissionID  string
	clientID      string
	clientSecret  string
	subjectHeader string
	client        *http.Client
}

func New(_ context.Context, next http.Handler, config *Config, _ string) (http.Handler, error) {
	if next == nil {
		return nil, errors.New("next handler is required")
	}
	if config == nil {
		return nil, errors.New("configuration is required")
	}

	endpoint, err := parseEndpoint(config.Endpoint)
	if err != nil {
		return nil, err
	}

	permissionID := strings.TrimSpace(config.PermissionID)
	if permissionID == "" {
		return nil, errors.New("permissionId is required")
	}

	clientID := strings.TrimSpace(config.ClientID)
	if clientID == "" {
		return nil, errors.New("clientId is required")
	}

	secretEnv := strings.TrimSpace(config.ClientSecretEnv)
	if secretEnv == "" {
		return nil, errors.New("clientSecretEnv is required")
	}
	clientSecret := os.Getenv(secretEnv)
	if clientSecret == "" {
		return nil, fmt.Errorf("environment variable %s is empty", secretEnv)
	}

	subjectHeader := strings.TrimSpace(config.SubjectHeader)
	if subjectHeader == "" {
		return nil, errors.New("subjectHeader is required")
	}

	timeout, err := time.ParseDuration(config.Timeout)
	if err != nil || timeout <= 0 {
		return nil, fmt.Errorf("timeout must be a positive duration: %q", config.Timeout)
	}

	return &enforcer{
		next:          next,
		endpoint:      endpoint,
		permissionID:  permissionID,
		clientID:      clientID,
		clientSecret:  clientSecret,
		subjectHeader: subjectHeader,
		client:        &http.Client{Timeout: timeout},
	}, nil
}

func parseEndpoint(value string) (*url.URL, error) {
	endpoint, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return nil, fmt.Errorf("invalid endpoint: %w", err)
	}
	if endpoint.Scheme != "http" && endpoint.Scheme != "https" {
		return nil, errors.New("endpoint scheme must be http or https")
	}
	if endpoint.Host == "" {
		return nil, errors.New("endpoint host is required")
	}
	if endpoint.RawQuery != "" || endpoint.Fragment != "" {
		return nil, errors.New("endpoint must not contain a query or fragment")
	}

	endpoint.Path = strings.TrimRight(endpoint.Path, "/") + "/api/enforce"
	return endpoint, nil
}

func (e *enforcer) ServeHTTP(w http.ResponseWriter, request *http.Request) {
	subject := strings.TrimSpace(request.Header.Get(e.subjectHeader))
	if !validSubject(subject) {
		http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		return
	}

	allowed, err := e.authorize(request.Context(), []string{
		subject,
		requestObject(request),
		strings.ToUpper(request.Method),
	})
	if err != nil {
		http.Error(w, http.StatusText(http.StatusServiceUnavailable), http.StatusServiceUnavailable)
		return
	}
	if !allowed {
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		return
	}

	e.next.ServeHTTP(w, request)
}

func validSubject(subject string) bool {
	owner, name, found := strings.Cut(subject, "/")
	return found && owner != "" && name != "" && !strings.ContainsAny(subject, "\r\n")
}

func requestObject(request *http.Request) string {
	path := request.URL.EscapedPath()
	if path == "" {
		path = "/"
	}
	return strings.ToLower(request.Host) + path
}

type casdoorResponse struct {
	Status string          `json:"status"`
	Msg    string          `json:"msg"`
	Data   json.RawMessage `json:"data"`
}

func (e *enforcer) authorize(ctx context.Context, casbinRequest []string) (bool, error) {
	body, err := json.Marshal(casbinRequest)
	if err != nil {
		return false, fmt.Errorf("encode Casbin request: %w", err)
	}

	endpoint := *e.endpoint
	query := endpoint.Query()
	query.Set("permissionId", e.permissionID)
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), bytes.NewReader(body))
	if err != nil {
		return false, fmt.Errorf("create Casdoor request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(e.clientID, e.clientSecret)

	response, err := e.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("call Casdoor: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK && response.StatusCode != http.StatusForbidden {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxResponseBodyBytes))
		return false, fmt.Errorf("Casdoor returned HTTP %d", response.StatusCode)
	}

	var result casdoorResponse
	decoder := json.NewDecoder(io.LimitReader(response.Body, maxResponseBodyBytes))
	if err := decoder.Decode(&result); err != nil {
		return false, fmt.Errorf("decode Casdoor response: %w", err)
	}
	if result.Status != "ok" {
		return false, fmt.Errorf("Casdoor response status is %q", result.Status)
	}
	if len(result.Data) == 0 || bytes.Equal(bytes.TrimSpace(result.Data), []byte("null")) {
		return false, errors.New("Casdoor response data is missing")
	}

	var decisions []bool
	if err := json.Unmarshal(result.Data, &decisions); err != nil {
		return false, fmt.Errorf("decode Casdoor decisions: %w", err)
	}
	for _, allowed := range decisions {
		if allowed {
			return true, nil
		}
	}
	return false, nil
}
