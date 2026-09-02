{{- define "rustfs-wrapper.serviceName" -}}
{{- default (printf "%s-svc" .Release.Name) .Values.rustfsIngress.service.name -}}
{{- end -}}

{{- define "rustfs-wrapper.hostRule" -}}
{{- $hosts := .Values.rustfsIngress.hosts | default (list .Values.rustfsIngress.host) -}}
{{- range $index, $host := $hosts -}}
{{- if $index }} || {{ end -}}
Host(`{{ required "rustfsIngress.host is required" $host }}`)
{{- end -}}
{{- end -}}
