## 安装 bitnami
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add conduktor-component https://helm.conduktor.io
helm repo update
```
## 运行 zookeeper
```bash
helm install zookeeper bitnami/zookeeper -f zookeeper/values.yaml
```

## 运行 kafka
```bash
helm install kafka bitnami/kafka -f kafka/values.yaml
```

## pg
```bash
helm install postgresql bitnami/postgresql -f postgresql/values.yaml 
```

## conduktor
```bash

```

## apisix
```bash
helm install apisix bitnami/apisix --kubeconfig ~/PycharmProjects/k8sClusters/0/cloud-cluster.yaml -f apisix/sample.yaml --namespace apisix --create-namespace

WARNING: Kubernetes configuration file is group-readable. This is insecure. Location: /Users/wangfeiyu/PycharmProjects/k8sClusters/0/cloud-cluster.yaml
WARNING: Kubernetes configuration file is world-readable. This is insecure. Location: /Users/wangfeiyu/PycharmProjects/k8sClusters/0/cloud-cluster.yaml
NAME: apisix
LAST DEPLOYED: Tue Aug 13 13:39:04 2024
NAMESPACE: apisix
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
CHART NAME: apisix
CHART VERSION: 3.3.9
APP VERSION: 3.9.1

** Please be patient while the chart is being deployed **

The following controllers have been deployed:
  - control-plane
  - ingress-controller

Check the status of the pods by running this command:

  kubectl get pods --namespace "apisix" -l app.kubernetes.io/instance=apisix

APISIX Control Plane:

    Your APISIX Control Plane Admin API site can be accessed through the following DNS name from within your cluster:

        apisix-control-plane.apisix.svc.cluster.local (port 9180)

    To access your Apisix site from outside the cluster follow the steps below:

    1. Get the Apisix URL by running these commands:

       kubectl port-forward --namespace apisix svc/apisix-control-plane 9180:9180 &
       echo "APISIX Control Plane Admin API URL: http://127.0.0.1:9180//"

    2. Access the API using the API Token below:

      echo API Token: $(kubectl get secret --namespace apisix apisix-control-plane-api-token -o jsonpath="{.data.admin-token}" | base64 -d)

The Ingress Class name to use the APISIX Ingress Controller is: "apisix"

⚠ SECURITY WARNING: Original containers have been substituted. This Helm chart was designed, tested, and validated on multiple platforms using a specific set of Bitnami and Tanzu Application Catalog containers. Substituting other containers is likely to cause degraded security and performance, broken chart features, and missing environment variables.

Substituted images detected:
  - registry.cn-shenzhen.aliyuncs.com/gravitation/apisix:3.9.1-debian-12-r8
  - registry.cn-shenzhen.aliyuncs.com/gravitation/apisix-ingress-controller:1.8.2-debian-12-r11
  - registry.cn-shenzhen.aliyuncs.com/gravitation/os-shell:12-debian-12-r27
```