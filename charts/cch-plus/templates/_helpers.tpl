{{/* Expand the name of the chart. */}}
{{- define "cch-plus.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Create a default fully qualified app name. */}}
{{- define "cch-plus.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "cch-plus.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "cch-plus.labels" -}}
helm.sh/chart: {{ include "cch-plus.chart" . }}
{{ include "cch-plus.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "cch-plus.selectorLabels" -}}
app.kubernetes.io/name: {{ include "cch-plus.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "cch-plus.namespace" -}}
{{- default .Release.Namespace .Values.namespaceOverride -}}
{{- end }}

{{- define "cch-plus.image" -}}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) -}}
{{- end }}

{{- define "cch-plus.imagePullSecrets" -}}
{{- with .Values.imagePullSecrets }}
imagePullSecrets:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}

{{- define "cch-plus.securityContext" -}}
allowPrivilegeEscalation: {{ .Values.securityContext.allowPrivilegeEscalation }}
readOnlyRootFilesystem: {{ .Values.securityContext.readOnlyRootFilesystem }}
capabilities:
  {{- toYaml .Values.securityContext.capabilities | nindent 2 }}
{{- end }}
