---
lang: zh-CN
title: hadoop statefulset 组件
description: hadoop statefulset 组件
---

## 说明

含有四个组件，如下表格：

| 文件名称            | 说明                   |
|-----------------|----------------------|
| namenode        | 一个简单的namenode        |
| datanode        | 一个简单的datanode        |
| nodemanager     | 一个简单的nodemanager     |
| resourcemanager | 一个简单的resourcemanager |

## namenode
```yaml
apiVersion: apps/v1
kind: StatefulSet

metadata:
  name: namenode
  labels:
    app: namenode

spec:
  replicas: 1

  updateStrategy:
    type: RollingUpdate

  minReadySeconds: 10
  serviceName: namenode-service

  selector:
    matchLabels:
      app: namenode

  template:
    metadata:
      name: namenode
      labels:
        app: namenode

    spec:
      initContainers:
        - name: hadoop-resource-init
          image: wfybelief/hadoop:3.4.0
          imagePullPolicy: IfNotPresent
          command:
            - busybox
            - sh
            - -c
          args:
            - |
              tar -zxvf /opt/component/storage/hadoop/hadoop-*.tar.gz -C /opt/component/hadoop --strip-components 1
          volumeMounts:
            - mountPath: /opt/component/hadoop
              name: hadoop-resource-volume


      containers:
        - name: namenode
          image: wfybelief/jdk-8:0.0.6
          imagePullPolicy: IfNotPresent

          command:
            - busybox
            - sh
            - entrypoint.sh
          args:
            - hdfs
            - namenode
          env:
            - name: HDFS_NAMENODE_OPTS
              value: -XX:+UseContainerSupport
                -XX:InitialRAMPercentage=60.0
                -XX:MaxRAMPercentage=60.0 
                -Xshareclasses 
                -Xtune:virtualized 
                -Xquickstart 

          resources:
            limits:
              cpu: 2000m  # 2048 / 1
              memory: 2048Mi
            requests:
              memory: 10Mi
              cpu: 1m

          ports:
            - containerPort: 9870
              protocol: TCP

          volumeMounts:
            - mountPath: /opt/component/storage/
              name: component-storage
              readOnly: false

            - mountPath: /opt/component/hadoop
              name: hadoop-resource-volume
              readOnly: false

            - mountPath: /entrypoint.sh
              subPath: entrypoint.sh
              name: namenode-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/core-site.xml
              subPath: core-site.xml
              name: namenode-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/hdfs-site.xml
              subPath: hdfs-site.xml
              name: namenode-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/mapred-site.xml
              subPath: mapred-site.xml
              name: namenode-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/yarn-site.xml
              subPath: yarn-site.xml
              name: namenode-config-volume
              readOnly: true

      volumes:
        - name: namenode-config-volume

          configMap:
            name: hadoop-configmap

            items:
              - key: core-site.xml
                path: core-site.xml

              - key: hdfs-site.xml
                path: hdfs-site.xml

              - key: mapred-site.xml
                path: mapred-site.xml

              - key: yarn-site.xml
                path: yarn-site.xml

              - key: entrypoint.sh
                path: entrypoint.sh

        - name: hadoop-resource-volume
          emptyDir:
            { }

      restartPolicy: Always


  # 持久卷
  volumeClaimTemplates:
    - metadata:
        name: component-storage
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: standard # csi-disk-ssd | hostpath
        resources:
          requests:
            storage: 1Gi
          limits:
            storage: 10Gi
```

## datanode
```yaml
apiVersion: apps/v1
kind: StatefulSet

metadata:
  name: datanode
  labels:
    app: datanode

spec:
  replicas: 3

  updateStrategy:
    type: RollingUpdate

  minReadySeconds: 10
  serviceName: datanode-service

  selector:
    matchLabels:
      app: datanode

  template:
    metadata:
      name: datanode
      labels:
        app: datanode

    spec:
      initContainers:
        - name: hadoop-resource-init
          image: wfybelief/hadoop:3.4.0
          imagePullPolicy: IfNotPresent
          command:
            - busybox
            - sh
            - -c
          args:
            - |
              tar -zxvf /opt/component/storage/hadoop/hadoop-*.tar.gz -C /opt/component/hadoop --strip-components 1
          volumeMounts:
            - mountPath: /opt/component/hadoop
              name: hadoop-resource-volume


      containers:
        - name: datanode
          image: wfybelief/jdk-8:0.0.6
          imagePullPolicy: IfNotPresent

          command:
            - busybox
            - sh
            - entrypoint.sh
          args:
            - hdfs
            - datanode
          env:
            - name: HDFS_DATANODE_OPTS
              value: -XX:+UseContainerSupport
                -XX:InitialRAMPercentage=40.0
                -XX:MaxRAMPercentage=40.0
                -Xshareclasses
                -Xtune:virtualized
                -Xquickstart

          resources:
            limits:
              # 1024 / 1
              memory: 1024Mi
              cpu: 1000m
            requests:
              memory: 10Mi
              cpu: 1m

          ports:
            - containerPort: 9870
              protocol: TCP

          volumeMounts:
            - mountPath: /opt/component/storage/
              name: component-storage
              readOnly: false

            - mountPath: /opt/component/hadoop
              name: hadoop-resource-volume
              readOnly: false

            - mountPath: /entrypoint.sh
              subPath: entrypoint.sh
              name: datanode-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/core-site.xml
              subPath: core-site.xml
              name: datanode-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/hdfs-site.xml
              subPath: hdfs-site.xml
              name: datanode-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/mapred-site.xml
              subPath: mapred-site.xml
              name: datanode-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/yarn-site.xml
              subPath: yarn-site.xml
              name: datanode-config-volume
              readOnly: true

      volumes:
        - name: datanode-config-volume

          configMap:
            name: hadoop-configmap

            items:
              - key: core-site.xml
                path: core-site.xml

              - key: hdfs-site.xml
                path: hdfs-site.xml

              - key: mapred-site.xml
                path: mapred-site.xml

              - key: yarn-site.xml
                path: yarn-site.xml

              - key: entrypoint.sh
                path: entrypoint.sh

        - name: hadoop-resource-volume
          emptyDir:
            { }

      restartPolicy: Always


  # 持久卷
  volumeClaimTemplates:
    - metadata:
        name: component-storage
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: standard # csi-disk-ssd | hostpath
        resources:
          requests:
            storage: 1Gi
          limits:
            storage: 50Gi
```

## nodemanager
```yaml
apiVersion: apps/v1
kind: StatefulSet

metadata:
  name: nodemanager
  labels:
    app: nodemanager

spec:
  replicas: 3

  updateStrategy:
    type: RollingUpdate

  minReadySeconds: 10
  serviceName: nodemanager-service

  selector:
    matchLabels:
      app: nodemanager

  template:
    metadata:
      name: nodemanager
      labels:
        app: nodemanager

    spec:
      initContainers:
        - name: hadoop-resource-init
          image: wfybelief/hadoop:3.4.0
          imagePullPolicy: IfNotPresent
          command:
            - busybox
            - sh
            - -c
          args:
            - |
              tar -zxvf /opt/component/storage/hadoop/hadoop-*.tar.gz -C /opt/component/hadoop --strip-components 1
          volumeMounts:
            - mountPath: /opt/component/hadoop
              name: hadoop-resource-volume


      containers:
        - name: nodemanager
          image: wfybelief/jdk-8:0.0.6
          imagePullPolicy: IfNotPresent

          command:
            - busybox
            - sh
            - entrypoint.sh
          args:
            - yarn
            - nodemanager
          env:
            - name: YARN_NODEMANAGER_OPTS
              value: -XX:+UseContainerSupport
                -XX:InitialRAMPercentage=20.0
                -XX:MaxRAMPercentage=20.0
                -Xshareclasses
                -Xtune:virtualized
                -Xquickstart

          resources:
            limits:
              cpu: 2000m
              # 2048 / 1
              memory: 4096Mi
            requests:
              cpu: 1m
              memory: 10Mi

          ports:
            - containerPort: 9870
              protocol: TCP

          volumeMounts:

            - mountPath: /opt/component/hadoop
              name: hadoop-resource-volume
              readOnly: false

            - mountPath: /entrypoint.sh
              subPath: entrypoint.sh
              name: nodemanager-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/core-site.xml
              subPath: core-site.xml
              name: nodemanager-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/hdfs-site.xml
              subPath: hdfs-site.xml
              name: nodemanager-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/mapred-site.xml
              subPath: mapred-site.xml
              name: nodemanager-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/yarn-site.xml
              subPath: yarn-site.xml
              name: nodemanager-config-volume
              readOnly: true

      volumes:
        - name: nodemanager-config-volume

          configMap:
            name: hadoop-configmap

            items:
              - key: core-site.xml
                path: core-site.xml

              - key: hdfs-site.xml
                path: hdfs-site.xml

              - key: mapred-site.xml
                path: mapred-site.xml

              - key: yarn-site.xml
                path: yarn-site.xml

              - key: entrypoint.sh
                path: entrypoint.sh

        - name: hadoop-resource-volume
          emptyDir:
            { }

      restartPolicy: Always
```

## resourcemanager
```yaml
apiVersion: apps/v1
kind: StatefulSet

metadata:
  name: resourcemanager
  labels:
    app: resourcemanager

spec:
  replicas: 1

  updateStrategy:
    type: RollingUpdate

  minReadySeconds: 10
  serviceName: resourcemanager-service

  selector:
    matchLabels:
      app: resourcemanager

  template:
    metadata:
      name: resourcemanager
      labels:
        app: resourcemanager

    spec:
      initContainers:
        - name: hadoop-resource-init
          image: wfybelief/hadoop:3.4.0
          imagePullPolicy: IfNotPresent
          command:
            - busybox
            - sh
            - -c
          args:
            - |
              tar -zxvf /opt/component/storage/hadoop/hadoop-*.tar.gz -C /opt/component/hadoop --strip-components 1
          volumeMounts:
            - mountPath: /opt/component/hadoop
              name: hadoop-resource-volume


      containers:
        - name: resourcemanager
          image: wfybelief/jdk-8:0.0.6
          imagePullPolicy: IfNotPresent

          command:
            - busybox
            - sh
            - entrypoint.sh
          args:
            - yarn
            - resourcemanager
          env:
            - name: YARN_RESOURCEMANAGER_OPTS
              value: -XX:+UseContainerSupport
                -XX:InitialRAMPercentage=60.0
                -XX:MaxRAMPercentage=60.0
                -Xshareclasses
                -Xtune:virtualized
                -Xquickstart

          # 资源限制
          resources:
            limits:
              # 2048 / 1
              memory: 3072Mi
              cpu: 2000m
            requests:
              cpu: 1m
              memory: 10Mi

          ports:
            - containerPort: 8088
              protocol: TCP
            - containerPort: 19888
              protocol: TCP

          volumeMounts:

            - mountPath: /opt/component/hadoop
              name: hadoop-resource-volume
              readOnly: false

            - mountPath: /entrypoint.sh
              subPath: entrypoint.sh
              name: resourcemanager-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/core-site.xml
              subPath: core-site.xml
              name: resourcemanager-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/hdfs-site.xml
              subPath: hdfs-site.xml
              name: resourcemanager-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/mapred-site.xml
              subPath: mapred-site.xml
              name: resourcemanager-config-volume
              readOnly: true

            - mountPath: /opt/component/hadoop/etc/hadoop/yarn-site.xml
              subPath: yarn-site.xml
              name: resourcemanager-config-volume
              readOnly: true

      volumes:
        - name: resourcemanager-config-volume

          configMap:
            name: hadoop-configmap

            items:
              - key: core-site.xml
                path: core-site.xml

              - key: hdfs-site.xml
                path: hdfs-site.xml

              - key: mapred-site.xml
                path: mapred-site.xml

              - key: yarn-site.xml
                path: yarn-site.xml

              - key: entrypoint.sh
                path: entrypoint.sh

        - name: hadoop-resource-volume
          emptyDir:
            { }

      restartPolicy: Always
```