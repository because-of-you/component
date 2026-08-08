{{- define "rustfs-wrapper.serviceName" -}}
{{- default (printf "%s-svc" .Release.Name) .Values.rustfsIngress.service.name -}}
{{- end -}}
