{{- define "conduktor-gateway.wrapperName" -}}
{{- default "conduktor-gateway" .Values.gatewayServiceName -}}
{{- end -}}
