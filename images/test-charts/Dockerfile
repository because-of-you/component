FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

# Replace this with your application binary or runtime image.
COPY test-charts /app/test-charts

USER nonroot:nonroot
ENTRYPOINT ["/app/test-charts"]

