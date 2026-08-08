# Image synchronization

Container images mirrored into Aliyun ACR are declared per component:

```text
images/<component>/images.yaml
```

Each manifest can contain one or more images owned by that component:

```yaml
component: example

images:
  - name: application
    source: ghcr.io/example/application:1.2.3
    destination: registry.cn-shenzhen.aliyuncs.com/gravitation/application:1.2.3
```

Pushing a changed manifest to `dev` runs `Sync Images` for that component only. The workflow compares registry
digests and skips content already present in ACR. It can also be run manually with a component directory name or
`all`.

Only the `images.yaml` filename is supported. YAML aliases are rejected. The parser emits JSON only as the
internal matrix representation required by GitHub Actions.

Prefer immutable version or commit tags. Keep every destination reference consistent with the image rendered by
the corresponding Helm values.
