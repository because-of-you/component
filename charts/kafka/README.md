```cat > /tmp/tmp.properties << EOF
security.protocol=SASL_PLAINTEXT
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required \
        username="kafka" \
        password="QHZTQCVTN3A2JXlXaCEmaU1AYjBTZyRuSEImMmU3UE0=";
EOF

```

```bash
kafka-producer-perf-test.sh --topic pref_test --num-records 1000000 --record-size 1024 --throughput -1 --producer-props bootstrap.servers=kafka.default:9
092 --producer.config /tmp/tmp.properties
```