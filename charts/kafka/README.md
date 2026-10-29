# Kafka

This chart wraps Bitnami Kafka and runs a KRaft cluster inside the `infra`
namespace. The chart defaults to three nodes, while the dev environment starts
with one combined controller/broker node to keep resource usage low. Kafka is
intentionally exposed as a `ClusterIP`; Conduktor Gateway will provide the
public SNI endpoint later.

The development values use a custom Kafka image that keeps the Bitnami Kafka
entrypoint and replaces the bundled JDK with IBM Semeru OpenJ9 17. The JVM
heap is sized from the container limit and uses OpenJ9 shared classes:

```text
-XX:InitialRAMPercentage=20.0
-XX:MaxRAMPercentage=45.0
-Xshareclasses:cacheDir=/tmp/javasharedresources,name=kafka
-Xtune:virtualized
-Xquickstart
```

The image is built from `images/kafka/Dockerfile` and published by the dev
deployment workflow before the Kafka release is synchronized.
