import{_ as n,o as s,c as a,e}from"./app-STO-5Cne.js";const t={},p=e(`<h2 id="说明" tabindex="-1"><a class="header-anchor" href="#说明" aria-hidden="true">#</a> 说明</h2><p>含有四个组件，如下表格：</p><table><thead><tr><th>文件名称</th><th>说明</th></tr></thead><tbody><tr><td>namenode</td><td>一个简单的namenode</td></tr><tr><td>datanode</td><td>一个简单的datanode</td></tr><tr><td>nodemanager</td><td>一个简单的nodemanager</td></tr><tr><td>resourcemanager</td><td>一个简单的resourcemanager</td></tr></tbody></table><h2 id="namenode" tabindex="-1"><a class="header-anchor" href="#namenode" aria-hidden="true">#</a> namenode</h2><div class="language-yaml line-numbers-mode" data-ext="yml"><pre class="language-yaml"><code><span class="token key atrule">apiVersion</span><span class="token punctuation">:</span> apps/v1
<span class="token key atrule">kind</span><span class="token punctuation">:</span> StatefulSet

<span class="token key atrule">metadata</span><span class="token punctuation">:</span>
  <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode
  <span class="token key atrule">labels</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> namenode

<span class="token key atrule">spec</span><span class="token punctuation">:</span>
  <span class="token key atrule">replicas</span><span class="token punctuation">:</span> <span class="token number">1</span>

  <span class="token key atrule">updateStrategy</span><span class="token punctuation">:</span>
    <span class="token key atrule">type</span><span class="token punctuation">:</span> RollingUpdate

  <span class="token key atrule">minReadySeconds</span><span class="token punctuation">:</span> <span class="token number">10</span>
  <span class="token key atrule">serviceName</span><span class="token punctuation">:</span> namenode<span class="token punctuation">-</span>service

  <span class="token key atrule">selector</span><span class="token punctuation">:</span>
    <span class="token key atrule">matchLabels</span><span class="token punctuation">:</span>
      <span class="token key atrule">app</span><span class="token punctuation">:</span> namenode

  <span class="token key atrule">template</span><span class="token punctuation">:</span>
    <span class="token key atrule">metadata</span><span class="token punctuation">:</span>
      <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode
      <span class="token key atrule">labels</span><span class="token punctuation">:</span>
        <span class="token key atrule">app</span><span class="token punctuation">:</span> namenode

    <span class="token key atrule">spec</span><span class="token punctuation">:</span>
      <span class="token key atrule">initContainers</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>init
          <span class="token key atrule">image</span><span class="token punctuation">:</span> wfybelief/hadoop<span class="token punctuation">:</span>3.3.6
          <span class="token key atrule">imagePullPolicy</span><span class="token punctuation">:</span> IfNotPresent
          <span class="token key atrule">command</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> busybox
            <span class="token punctuation">-</span> sh
            <span class="token punctuation">-</span> <span class="token punctuation">-</span>c
          <span class="token key atrule">args</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token punctuation">|</span><span class="token scalar string">
              tar -zxvf /opt/component/storage/hadoop/hadoop-*.tar.gz -C /opt/component/hadoop --strip-components 1</span>
          <span class="token key atrule">volumeMounts</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop
              <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume


      <span class="token key atrule">containers</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode
          <span class="token key atrule">image</span><span class="token punctuation">:</span> wfybelief/jdk<span class="token punctuation">-</span>8<span class="token punctuation">:</span>0.0.4
          <span class="token key atrule">imagePullPolicy</span><span class="token punctuation">:</span> IfNotPresent

          <span class="token key atrule">command</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> busybox
            <span class="token punctuation">-</span> sh
            <span class="token punctuation">-</span> entrypoint.sh
          <span class="token key atrule">args</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> hdfs
            <span class="token punctuation">-</span> namenode
          <span class="token key atrule">env</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> HDFS_NAMENODE_OPTS
              <span class="token key atrule">value</span><span class="token punctuation">:</span> <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>+UseContainerSupport
                <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>InitialRAMPercentage=60.0
                <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>MaxRAMPercentage=60.0 
                <span class="token punctuation">-</span>Xshareclasses 
                <span class="token punctuation">-</span>Xtune<span class="token punctuation">:</span>virtualized 
                <span class="token punctuation">-</span>Xquickstart 

          <span class="token key atrule">resources</span><span class="token punctuation">:</span>
            <span class="token key atrule">limits</span><span class="token punctuation">:</span>
              <span class="token key atrule">cpu</span><span class="token punctuation">:</span> 2000m  <span class="token comment"># 2048 / 1</span>
              <span class="token key atrule">memory</span><span class="token punctuation">:</span> 2048Mi
            <span class="token key atrule">requests</span><span class="token punctuation">:</span>
              <span class="token key atrule">memory</span><span class="token punctuation">:</span> 10Mi
              <span class="token key atrule">cpu</span><span class="token punctuation">:</span> 1m

          <span class="token key atrule">ports</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">containerPort</span><span class="token punctuation">:</span> <span class="token number">9870</span>
              <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP

          <span class="token key atrule">volumeMounts</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/storage/
              <span class="token key atrule">name</span><span class="token punctuation">:</span> component<span class="token punctuation">-</span>storage
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">false</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop
              <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">false</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /entrypoint.sh
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> entrypoint.sh
              <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/core<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/hdfs<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/mapred<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/yarn<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

      <span class="token key atrule">volumes</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume

          <span class="token key atrule">configMap</span><span class="token punctuation">:</span>
            <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>configmap

            <span class="token key atrule">items</span><span class="token punctuation">:</span>
              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> entrypoint.sh
                <span class="token key atrule">path</span><span class="token punctuation">:</span> entrypoint.sh

        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume
          <span class="token key atrule">emptyDir</span><span class="token punctuation">:</span>
            <span class="token punctuation">{</span> <span class="token punctuation">}</span>

      <span class="token key atrule">restartPolicy</span><span class="token punctuation">:</span> Always


  <span class="token comment"># 持久卷</span>
  <span class="token key atrule">volumeClaimTemplates</span><span class="token punctuation">:</span>
    <span class="token punctuation">-</span> <span class="token key atrule">metadata</span><span class="token punctuation">:</span>
        <span class="token key atrule">name</span><span class="token punctuation">:</span> component<span class="token punctuation">-</span>storage
      <span class="token key atrule">spec</span><span class="token punctuation">:</span>
        <span class="token key atrule">accessModes</span><span class="token punctuation">:</span>
          <span class="token punctuation">-</span> ReadWriteOnce
        <span class="token key atrule">storageClassName</span><span class="token punctuation">:</span> standard <span class="token comment"># csi-disk-ssd | hostpath</span>
        <span class="token key atrule">resources</span><span class="token punctuation">:</span>
          <span class="token key atrule">requests</span><span class="token punctuation">:</span>
            <span class="token key atrule">storage</span><span class="token punctuation">:</span> 1Gi
          <span class="token key atrule">limits</span><span class="token punctuation">:</span>
            <span class="token key atrule">storage</span><span class="token punctuation">:</span> 10Gi
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="datanode" tabindex="-1"><a class="header-anchor" href="#datanode" aria-hidden="true">#</a> datanode</h2><div class="language-yaml line-numbers-mode" data-ext="yml"><pre class="language-yaml"><code><span class="token key atrule">apiVersion</span><span class="token punctuation">:</span> apps/v1
<span class="token key atrule">kind</span><span class="token punctuation">:</span> StatefulSet

<span class="token key atrule">metadata</span><span class="token punctuation">:</span>
  <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode
  <span class="token key atrule">labels</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> datanode

<span class="token key atrule">spec</span><span class="token punctuation">:</span>
  <span class="token key atrule">replicas</span><span class="token punctuation">:</span> <span class="token number">3</span>

  <span class="token key atrule">updateStrategy</span><span class="token punctuation">:</span>
    <span class="token key atrule">type</span><span class="token punctuation">:</span> RollingUpdate

  <span class="token key atrule">minReadySeconds</span><span class="token punctuation">:</span> <span class="token number">10</span>
  <span class="token key atrule">serviceName</span><span class="token punctuation">:</span> datanode<span class="token punctuation">-</span>service

  <span class="token key atrule">selector</span><span class="token punctuation">:</span>
    <span class="token key atrule">matchLabels</span><span class="token punctuation">:</span>
      <span class="token key atrule">app</span><span class="token punctuation">:</span> datanode

  <span class="token key atrule">template</span><span class="token punctuation">:</span>
    <span class="token key atrule">metadata</span><span class="token punctuation">:</span>
      <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode
      <span class="token key atrule">labels</span><span class="token punctuation">:</span>
        <span class="token key atrule">app</span><span class="token punctuation">:</span> datanode

    <span class="token key atrule">spec</span><span class="token punctuation">:</span>
      <span class="token key atrule">initContainers</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>init
          <span class="token key atrule">image</span><span class="token punctuation">:</span> wfybelief/hadoop<span class="token punctuation">:</span>3.3.6
          <span class="token key atrule">imagePullPolicy</span><span class="token punctuation">:</span> IfNotPresent
          <span class="token key atrule">command</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> busybox
            <span class="token punctuation">-</span> sh
            <span class="token punctuation">-</span> <span class="token punctuation">-</span>c
          <span class="token key atrule">args</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token punctuation">|</span><span class="token scalar string">
              tar -zxvf /opt/component/storage/hadoop/hadoop-*.tar.gz -C /opt/component/hadoop --strip-components 1</span>
          <span class="token key atrule">volumeMounts</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop
              <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume


      <span class="token key atrule">containers</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode
          <span class="token key atrule">image</span><span class="token punctuation">:</span> wfybelief/jdk<span class="token punctuation">-</span>8<span class="token punctuation">:</span>0.0.4
          <span class="token key atrule">imagePullPolicy</span><span class="token punctuation">:</span> IfNotPresent

          <span class="token key atrule">command</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> busybox
            <span class="token punctuation">-</span> sh
            <span class="token punctuation">-</span> entrypoint.sh
          <span class="token key atrule">args</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> hdfs
            <span class="token punctuation">-</span> datanode
          <span class="token key atrule">env</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> HDFS_DATANODE_OPTS
              <span class="token key atrule">value</span><span class="token punctuation">:</span> <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>+UseContainerSupport
                <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>InitialRAMPercentage=40.0
                <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>MaxRAMPercentage=40.0
                <span class="token punctuation">-</span>Xshareclasses
                <span class="token punctuation">-</span>Xtune<span class="token punctuation">:</span>virtualized
                <span class="token punctuation">-</span>Xquickstart

          <span class="token key atrule">resources</span><span class="token punctuation">:</span>
            <span class="token key atrule">limits</span><span class="token punctuation">:</span>
              <span class="token comment"># 1024 / 1</span>
              <span class="token key atrule">memory</span><span class="token punctuation">:</span> 1024Mi
              <span class="token key atrule">cpu</span><span class="token punctuation">:</span> 1000m
            <span class="token key atrule">requests</span><span class="token punctuation">:</span>
              <span class="token key atrule">memory</span><span class="token punctuation">:</span> 10Mi
              <span class="token key atrule">cpu</span><span class="token punctuation">:</span> 1m

          <span class="token key atrule">ports</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">containerPort</span><span class="token punctuation">:</span> <span class="token number">9870</span>
              <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP

          <span class="token key atrule">volumeMounts</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/storage/
              <span class="token key atrule">name</span><span class="token punctuation">:</span> component<span class="token punctuation">-</span>storage
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">false</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop
              <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">false</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /entrypoint.sh
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> entrypoint.sh
              <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/core<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/hdfs<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/mapred<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/yarn<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

      <span class="token key atrule">volumes</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume

          <span class="token key atrule">configMap</span><span class="token punctuation">:</span>
            <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>configmap

            <span class="token key atrule">items</span><span class="token punctuation">:</span>
              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> entrypoint.sh
                <span class="token key atrule">path</span><span class="token punctuation">:</span> entrypoint.sh

        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume
          <span class="token key atrule">emptyDir</span><span class="token punctuation">:</span>
            <span class="token punctuation">{</span> <span class="token punctuation">}</span>

      <span class="token key atrule">restartPolicy</span><span class="token punctuation">:</span> Always


  <span class="token comment"># 持久卷</span>
  <span class="token key atrule">volumeClaimTemplates</span><span class="token punctuation">:</span>
    <span class="token punctuation">-</span> <span class="token key atrule">metadata</span><span class="token punctuation">:</span>
        <span class="token key atrule">name</span><span class="token punctuation">:</span> component<span class="token punctuation">-</span>storage
      <span class="token key atrule">spec</span><span class="token punctuation">:</span>
        <span class="token key atrule">accessModes</span><span class="token punctuation">:</span>
          <span class="token punctuation">-</span> ReadWriteOnce
        <span class="token key atrule">storageClassName</span><span class="token punctuation">:</span> standard <span class="token comment"># csi-disk-ssd | hostpath</span>
        <span class="token key atrule">resources</span><span class="token punctuation">:</span>
          <span class="token key atrule">requests</span><span class="token punctuation">:</span>
            <span class="token key atrule">storage</span><span class="token punctuation">:</span> 1Gi
          <span class="token key atrule">limits</span><span class="token punctuation">:</span>
            <span class="token key atrule">storage</span><span class="token punctuation">:</span> 50Gi
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="nodemanager" tabindex="-1"><a class="header-anchor" href="#nodemanager" aria-hidden="true">#</a> nodemanager</h2><div class="language-yaml line-numbers-mode" data-ext="yml"><pre class="language-yaml"><code><span class="token key atrule">apiVersion</span><span class="token punctuation">:</span> apps/v1
<span class="token key atrule">kind</span><span class="token punctuation">:</span> StatefulSet

<span class="token key atrule">metadata</span><span class="token punctuation">:</span>
  <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager
  <span class="token key atrule">labels</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> nodemanager

<span class="token key atrule">spec</span><span class="token punctuation">:</span>
  <span class="token key atrule">replicas</span><span class="token punctuation">:</span> <span class="token number">3</span>

  <span class="token key atrule">updateStrategy</span><span class="token punctuation">:</span>
    <span class="token key atrule">type</span><span class="token punctuation">:</span> RollingUpdate

  <span class="token key atrule">minReadySeconds</span><span class="token punctuation">:</span> <span class="token number">10</span>
  <span class="token key atrule">serviceName</span><span class="token punctuation">:</span> nodemanager<span class="token punctuation">-</span>service

  <span class="token key atrule">selector</span><span class="token punctuation">:</span>
    <span class="token key atrule">matchLabels</span><span class="token punctuation">:</span>
      <span class="token key atrule">app</span><span class="token punctuation">:</span> nodemanager

  <span class="token key atrule">template</span><span class="token punctuation">:</span>
    <span class="token key atrule">metadata</span><span class="token punctuation">:</span>
      <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager
      <span class="token key atrule">labels</span><span class="token punctuation">:</span>
        <span class="token key atrule">app</span><span class="token punctuation">:</span> nodemanager

    <span class="token key atrule">spec</span><span class="token punctuation">:</span>
      <span class="token key atrule">initContainers</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>init
          <span class="token key atrule">image</span><span class="token punctuation">:</span> wfybelief/hadoop<span class="token punctuation">:</span>3.3.6
          <span class="token key atrule">imagePullPolicy</span><span class="token punctuation">:</span> IfNotPresent
          <span class="token key atrule">command</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> busybox
            <span class="token punctuation">-</span> sh
            <span class="token punctuation">-</span> <span class="token punctuation">-</span>c
          <span class="token key atrule">args</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token punctuation">|</span><span class="token scalar string">
              tar -zxvf /opt/component/storage/hadoop/hadoop-*.tar.gz -C /opt/component/hadoop --strip-components 1</span>
          <span class="token key atrule">volumeMounts</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop
              <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume


      <span class="token key atrule">containers</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager
          <span class="token key atrule">image</span><span class="token punctuation">:</span> wfybelief/jdk<span class="token punctuation">-</span>8<span class="token punctuation">:</span>0.0.4
          <span class="token key atrule">imagePullPolicy</span><span class="token punctuation">:</span> IfNotPresent

          <span class="token key atrule">command</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> busybox
            <span class="token punctuation">-</span> sh
            <span class="token punctuation">-</span> entrypoint.sh
          <span class="token key atrule">args</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> yarn
            <span class="token punctuation">-</span> nodemanager
          <span class="token key atrule">env</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> YARN_NODEMANAGER_OPTS
              <span class="token key atrule">value</span><span class="token punctuation">:</span> <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>+UseContainerSupport
                <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>InitialRAMPercentage=20.0
                <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>MaxRAMPercentage=20.0
                <span class="token punctuation">-</span>Xshareclasses
                <span class="token punctuation">-</span>Xtune<span class="token punctuation">:</span>virtualized
                <span class="token punctuation">-</span>Xquickstart

          <span class="token key atrule">resources</span><span class="token punctuation">:</span>
            <span class="token key atrule">limits</span><span class="token punctuation">:</span>
              <span class="token key atrule">cpu</span><span class="token punctuation">:</span> 2000m
              <span class="token comment"># 2048 / 1</span>
              <span class="token key atrule">memory</span><span class="token punctuation">:</span> 4096Mi
            <span class="token key atrule">requests</span><span class="token punctuation">:</span>
              <span class="token key atrule">cpu</span><span class="token punctuation">:</span> 1m
              <span class="token key atrule">memory</span><span class="token punctuation">:</span> 10Mi

          <span class="token key atrule">ports</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">containerPort</span><span class="token punctuation">:</span> <span class="token number">9870</span>
              <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP

          <span class="token key atrule">volumeMounts</span><span class="token punctuation">:</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop
              <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">false</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /entrypoint.sh
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> entrypoint.sh
              <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/core<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/hdfs<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/mapred<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/yarn<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

      <span class="token key atrule">volumes</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume

          <span class="token key atrule">configMap</span><span class="token punctuation">:</span>
            <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>configmap

            <span class="token key atrule">items</span><span class="token punctuation">:</span>
              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> entrypoint.sh
                <span class="token key atrule">path</span><span class="token punctuation">:</span> entrypoint.sh

        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume
          <span class="token key atrule">emptyDir</span><span class="token punctuation">:</span>
            <span class="token punctuation">{</span> <span class="token punctuation">}</span>

      <span class="token key atrule">restartPolicy</span><span class="token punctuation">:</span> Always
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="resourcemanager" tabindex="-1"><a class="header-anchor" href="#resourcemanager" aria-hidden="true">#</a> resourcemanager</h2><div class="language-yaml line-numbers-mode" data-ext="yml"><pre class="language-yaml"><code><span class="token key atrule">apiVersion</span><span class="token punctuation">:</span> apps/v1
<span class="token key atrule">kind</span><span class="token punctuation">:</span> StatefulSet

<span class="token key atrule">metadata</span><span class="token punctuation">:</span>
  <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager
  <span class="token key atrule">labels</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> resourcemanager

<span class="token key atrule">spec</span><span class="token punctuation">:</span>
  <span class="token key atrule">replicas</span><span class="token punctuation">:</span> <span class="token number">1</span>

  <span class="token key atrule">updateStrategy</span><span class="token punctuation">:</span>
    <span class="token key atrule">type</span><span class="token punctuation">:</span> RollingUpdate

  <span class="token key atrule">minReadySeconds</span><span class="token punctuation">:</span> <span class="token number">10</span>
  <span class="token key atrule">serviceName</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>service

  <span class="token key atrule">selector</span><span class="token punctuation">:</span>
    <span class="token key atrule">matchLabels</span><span class="token punctuation">:</span>
      <span class="token key atrule">app</span><span class="token punctuation">:</span> resourcemanager

  <span class="token key atrule">template</span><span class="token punctuation">:</span>
    <span class="token key atrule">metadata</span><span class="token punctuation">:</span>
      <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager
      <span class="token key atrule">labels</span><span class="token punctuation">:</span>
        <span class="token key atrule">app</span><span class="token punctuation">:</span> resourcemanager

    <span class="token key atrule">spec</span><span class="token punctuation">:</span>
      <span class="token key atrule">initContainers</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>init
          <span class="token key atrule">image</span><span class="token punctuation">:</span> wfybelief/hadoop<span class="token punctuation">:</span>3.3.6
          <span class="token key atrule">imagePullPolicy</span><span class="token punctuation">:</span> IfNotPresent
          <span class="token key atrule">command</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> busybox
            <span class="token punctuation">-</span> sh
            <span class="token punctuation">-</span> <span class="token punctuation">-</span>c
          <span class="token key atrule">args</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token punctuation">|</span><span class="token scalar string">
              tar -zxvf /opt/component/storage/hadoop/hadoop-*.tar.gz -C /opt/component/hadoop --strip-components 1</span>
          <span class="token key atrule">volumeMounts</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop
              <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume


      <span class="token key atrule">containers</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager
          <span class="token key atrule">image</span><span class="token punctuation">:</span> wfybelief/jdk<span class="token punctuation">-</span>8<span class="token punctuation">:</span>0.0.4
          <span class="token key atrule">imagePullPolicy</span><span class="token punctuation">:</span> IfNotPresent

          <span class="token key atrule">command</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> busybox
            <span class="token punctuation">-</span> sh
            <span class="token punctuation">-</span> entrypoint.sh
          <span class="token key atrule">args</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> yarn
            <span class="token punctuation">-</span> resourcemanager
          <span class="token key atrule">env</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> YARN_RESOURCEMANAGER_OPTS
              <span class="token key atrule">value</span><span class="token punctuation">:</span> <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>+UseContainerSupport
                <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>InitialRAMPercentage=60.0
                <span class="token punctuation">-</span>XX<span class="token punctuation">:</span>MaxRAMPercentage=60.0
                <span class="token punctuation">-</span>Xshareclasses
                <span class="token punctuation">-</span>Xtune<span class="token punctuation">:</span>virtualized
                <span class="token punctuation">-</span>Xquickstart

          <span class="token comment"># 资源限制</span>
          <span class="token key atrule">resources</span><span class="token punctuation">:</span>
            <span class="token key atrule">limits</span><span class="token punctuation">:</span>
              <span class="token comment"># 2048 / 1</span>
              <span class="token key atrule">memory</span><span class="token punctuation">:</span> 3072Mi
              <span class="token key atrule">cpu</span><span class="token punctuation">:</span> 2000m
            <span class="token key atrule">requests</span><span class="token punctuation">:</span>
              <span class="token key atrule">cpu</span><span class="token punctuation">:</span> 1m
              <span class="token key atrule">memory</span><span class="token punctuation">:</span> 10Mi

          <span class="token key atrule">ports</span><span class="token punctuation">:</span>
            <span class="token punctuation">-</span> <span class="token key atrule">containerPort</span><span class="token punctuation">:</span> <span class="token number">8088</span>
              <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP
            <span class="token punctuation">-</span> <span class="token key atrule">containerPort</span><span class="token punctuation">:</span> <span class="token number">19888</span>
              <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP

          <span class="token key atrule">volumeMounts</span><span class="token punctuation">:</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop
              <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">false</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /entrypoint.sh
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> entrypoint.sh
              <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/core<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/hdfs<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/mapred<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

            <span class="token punctuation">-</span> <span class="token key atrule">mountPath</span><span class="token punctuation">:</span> /opt/component/hadoop/etc/hadoop/yarn<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">subPath</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml
              <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume
              <span class="token key atrule">readOnly</span><span class="token punctuation">:</span> <span class="token boolean important">true</span>

      <span class="token key atrule">volumes</span><span class="token punctuation">:</span>
        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>config<span class="token punctuation">-</span>volume

          <span class="token key atrule">configMap</span><span class="token punctuation">:</span>
            <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>configmap

            <span class="token key atrule">items</span><span class="token punctuation">:</span>
              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> core<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> hdfs<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> mapred<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml
                <span class="token key atrule">path</span><span class="token punctuation">:</span> yarn<span class="token punctuation">-</span>site.xml

              <span class="token punctuation">-</span> <span class="token key atrule">key</span><span class="token punctuation">:</span> entrypoint.sh
                <span class="token key atrule">path</span><span class="token punctuation">:</span> entrypoint.sh

        <span class="token punctuation">-</span> <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>resource<span class="token punctuation">-</span>volume
          <span class="token key atrule">emptyDir</span><span class="token punctuation">:</span>
            <span class="token punctuation">{</span> <span class="token punctuation">}</span>

      <span class="token key atrule">restartPolicy</span><span class="token punctuation">:</span> Always
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,11),l=[p];function i(c,u){return s(),a("div",null,l)}const k=n(t,[["render",i],["__file","hadoop-statefulset.html.vue"]]);export{k as default};
