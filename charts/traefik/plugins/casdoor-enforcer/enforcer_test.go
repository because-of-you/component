package casdoor_enforcer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCreateConfigDefaults(t *testing.T) {
	config := CreateConfig()

	if config.SubjectHeader != "X-Casdoor-Subject" {
		t.Fatalf("SubjectHeader = %q", config.SubjectHeader)
	}
	if config.ClientSecretEnv != "CASDOOR_ENFORCER_CLIENT_SECRET" {
		t.Fatalf("ClientSecretEnv = %q", config.ClientSecretEnv)
	}
	if config.Timeout != "2s" {
		t.Fatalf("Timeout = %q", config.Timeout)
	}
}

func TestNewRejectsMissingRequiredConfiguration(t *testing.T) {
	t.Setenv("CASDOOR_ENFORCER_CLIENT_SECRET", "secret")

	tests := []struct {
		name   string
		config *Config
	}{
		{name: "endpoint", config: &Config{PermissionID: "built-in/gateway", ClientID: "client", ClientSecretEnv: "CASDOOR_ENFORCER_CLIENT_SECRET", SubjectHeader: "X-Casdoor-Subject", Timeout: "2s"}},
		{name: "permission id", config: &Config{Endpoint: "https://casdoor.example.com", ClientID: "client", ClientSecretEnv: "CASDOOR_ENFORCER_CLIENT_SECRET", SubjectHeader: "X-Casdoor-Subject", Timeout: "2s"}},
		{name: "client id", config: &Config{Endpoint: "https://casdoor.example.com", PermissionID: "built-in/gateway", ClientSecretEnv: "CASDOOR_ENFORCER_CLIENT_SECRET", SubjectHeader: "X-Casdoor-Subject", Timeout: "2s"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := New(context.Background(), http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}), tt.config, "test"); err == nil {
				t.Fatal("New() error = nil")
			}
		})
	}
}

func TestNewRejectsMissingClientSecret(t *testing.T) {
	config := validConfig("http://casdoor.invalid")
	config.ClientSecretEnv = "CASDOOR_ENFORCER_TEST_MISSING"

	if _, err := New(context.Background(), http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}), config, "test"); err == nil {
		t.Fatal("New() error = nil")
	}
}

func TestAllowsAuthorizedRequestAndMapsCasbinArguments(t *testing.T) {
	var gotRequest []string
	var gotUsername string
	var gotPassword string
	casdoor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/enforce" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if r.URL.Query().Get("permissionId") != "built-in/gateway" {
			t.Errorf("permissionId = %q", r.URL.Query().Get("permissionId"))
		}
		gotUsername, gotPassword, _ = r.BasicAuth()
		if err := json.NewDecoder(r.Body).Decode(&gotRequest); err != nil {
			t.Errorf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","data":[true]}`))
	}))
	defer casdoor.Close()

	nextCalled := false
	handler := newHandler(t, casdoor.URL, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "https://API.ACITRUS.CN/api/users/a%2Fb?token=secret", nil)
	req.Host = "API.ACITRUS.CN"
	req.Header.Set("X-Casdoor-Subject", "built-in/alice")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, body = %q", recorder.Code, recorder.Body.String())
	}
	if !nextCalled {
		t.Fatal("next handler was not called")
	}
	if gotUsername != "client-id" || gotPassword != "client-secret" {
		t.Fatalf("basic auth = %q / %q", gotUsername, gotPassword)
	}
	want := []string{"built-in/alice", "api.acitrus.cn/api/users/a%2Fb", http.MethodPost}
	if strings.Join(gotRequest, "|") != strings.Join(want, "|") {
		t.Fatalf("request = %#v, want %#v", gotRequest, want)
	}
}

func TestDeniesWhenCasdoorReturnsFalse(t *testing.T) {
	casdoor := newCasdoorServer(`{"status":"ok","data":[false]}`, http.StatusOK)
	defer casdoor.Close()

	nextCalled := false
	handler := newHandler(t, casdoor.URL, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		nextCalled = true
	}))
	recorder := serveAuthenticated(handler)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d", recorder.Code)
	}
	if nextCalled {
		t.Fatal("next handler was called")
	}
}

func TestRejectsMissingSubjectWithoutCallingCasdoor(t *testing.T) {
	calls := 0
	casdoor := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		calls++
	}))
	defer casdoor.Close()

	handler := newHandler(t, casdoor.URL, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	req := httptest.NewRequest(http.MethodGet, "https://api.acitrus.cn/api/users", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", recorder.Code)
	}
	if calls != 0 {
		t.Fatalf("Casdoor calls = %d", calls)
	}
}

func TestReturnsServiceUnavailableForInvalidCasdoorResponse(t *testing.T) {
	tests := []struct {
		name   string
		status int
		body   string
	}{
		{name: "upstream status", status: http.StatusInternalServerError, body: `failure`},
		{name: "invalid json", status: http.StatusOK, body: `{`},
		{name: "error response", status: http.StatusOK, body: `{"status":"error","msg":"broken","data":[]}`},
		{name: "invalid data", status: http.StatusOK, body: `{"status":"ok","data":null}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			casdoor := newCasdoorServer(tt.body, tt.status)
			defer casdoor.Close()
			handler := newHandler(t, casdoor.URL, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))

			if recorder := serveAuthenticated(handler); recorder.Code != http.StatusServiceUnavailable {
				t.Fatalf("status = %d, body = %q", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestReturnsServiceUnavailableWhenCasdoorTimesOut(t *testing.T) {
	casdoor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		_, _ = w.Write([]byte(`{"status":"ok","data":[true]}`))
	}))
	defer casdoor.Close()

	config := validConfig(casdoor.URL)
	config.Timeout = "5ms"
	t.Setenv(config.ClientSecretEnv, "client-secret")
	handler, err := New(context.Background(), http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}), config, "test")
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	if recorder := serveAuthenticated(handler); recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d", recorder.Code)
	}
}

func validConfig(endpoint string) *Config {
	return &Config{
		Endpoint:        endpoint,
		PermissionID:    "built-in/gateway",
		ClientID:        "client-id",
		ClientSecretEnv: "CASDOOR_ENFORCER_CLIENT_SECRET",
		SubjectHeader:   "X-Casdoor-Subject",
		Timeout:         "2s",
	}
}

func newHandler(t *testing.T, endpoint string, next http.Handler) http.Handler {
	t.Helper()
	config := validConfig(endpoint)
	t.Setenv(config.ClientSecretEnv, "client-secret")
	handler, err := New(context.Background(), next, config, "test")
	if err != nil {
		t.Fatalf("New(): %v", err)
	}
	return handler
}

func newCasdoorServer(body string, status int) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
}

func serveAuthenticated(handler http.Handler) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "https://api.acitrus.cn/api/users", nil)
	req.Header.Set("X-Casdoor-Subject", "built-in/alice")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}
