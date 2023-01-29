#!/bin/bash
sleep 10s
/opt/hive/bin/schematool -dbType mysql -initSchema
hive --service metastore