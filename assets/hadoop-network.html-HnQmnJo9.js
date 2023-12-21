import{_ as n,o as a,c as s,e}from"./app-STO-5Cne.js";const t={},p=e(`<h2 id="说明" tabindex="-1"><a class="header-anchor" href="#说明" aria-hidden="true">#</a> 说明</h2><p>含有四个网络，如下表格：</p><table><thead><tr><th>文件名称</th><th>说明</th></tr></thead><tbody><tr><td>namenode-service</td><td>一个简单的namenode-service</td></tr><tr><td>datanode-service</td><td>一个简单的datanode-service</td></tr><tr><td>nodemanager-service</td><td>一个简单的nodemanager-service</td></tr><tr><td>resourcemanager-service</td><td>一个简单的resourcemanager-service</td></tr></tbody></table><h2 id="namenode-service" tabindex="-1"><a class="header-anchor" href="#namenode-service" aria-hidden="true">#</a> namenode-service</h2><div class="language-yaml line-numbers-mode" data-ext="yml"><pre class="language-yaml"><code><span class="token key atrule">apiVersion</span><span class="token punctuation">:</span> v1
<span class="token key atrule">kind</span><span class="token punctuation">:</span> Service
<span class="token key atrule">metadata</span><span class="token punctuation">:</span>
  <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode<span class="token punctuation">-</span>service
  <span class="token key atrule">labels</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> namenode
<span class="token key atrule">spec</span><span class="token punctuation">:</span>
  <span class="token key atrule">ports</span><span class="token punctuation">:</span>
    <span class="token punctuation">-</span> <span class="token key atrule">port</span><span class="token punctuation">:</span> <span class="token number">9870</span>
      <span class="token key atrule">name</span><span class="token punctuation">:</span> namenode<span class="token punctuation">-</span>web
      <span class="token key atrule">targetPort</span><span class="token punctuation">:</span> <span class="token number">9870</span>
      <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP

  <span class="token key atrule">clusterIP</span><span class="token punctuation">:</span> None
  <span class="token key atrule">selector</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> namenode
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="datanode-service" tabindex="-1"><a class="header-anchor" href="#datanode-service" aria-hidden="true">#</a> datanode-service</h2><div class="language-yaml line-numbers-mode" data-ext="yml"><pre class="language-yaml"><code><span class="token key atrule">apiVersion</span><span class="token punctuation">:</span> v1
<span class="token key atrule">kind</span><span class="token punctuation">:</span> Service
<span class="token key atrule">metadata</span><span class="token punctuation">:</span>
  <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode<span class="token punctuation">-</span>service
  <span class="token key atrule">labels</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> datanode
<span class="token key atrule">spec</span><span class="token punctuation">:</span>
  <span class="token key atrule">ports</span><span class="token punctuation">:</span>
    <span class="token punctuation">-</span> <span class="token key atrule">port</span><span class="token punctuation">:</span> <span class="token number">9870</span>
      <span class="token key atrule">name</span><span class="token punctuation">:</span> datanode<span class="token punctuation">-</span>web
      <span class="token key atrule">targetPort</span><span class="token punctuation">:</span> <span class="token number">9870</span>
      <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP

  <span class="token key atrule">clusterIP</span><span class="token punctuation">:</span> None
  <span class="token key atrule">selector</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> datanode
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="nodemanager-service" tabindex="-1"><a class="header-anchor" href="#nodemanager-service" aria-hidden="true">#</a> nodemanager-service</h2><div class="language-yaml line-numbers-mode" data-ext="yml"><pre class="language-yaml"><code><span class="token key atrule">apiVersion</span><span class="token punctuation">:</span> v1
<span class="token key atrule">kind</span><span class="token punctuation">:</span> Service
<span class="token key atrule">metadata</span><span class="token punctuation">:</span>
  <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager<span class="token punctuation">-</span>service
  <span class="token key atrule">labels</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> nodemanager
<span class="token key atrule">spec</span><span class="token punctuation">:</span>
  <span class="token key atrule">ports</span><span class="token punctuation">:</span>
    <span class="token punctuation">-</span> <span class="token key atrule">port</span><span class="token punctuation">:</span> <span class="token number">9870</span>
      <span class="token key atrule">name</span><span class="token punctuation">:</span> nodemanager<span class="token punctuation">-</span>web
      <span class="token key atrule">targetPort</span><span class="token punctuation">:</span> <span class="token number">9870</span>
      <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP

  <span class="token key atrule">clusterIP</span><span class="token punctuation">:</span> None
  <span class="token key atrule">selector</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> nodemanager
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="resourcemanager-service" tabindex="-1"><a class="header-anchor" href="#resourcemanager-service" aria-hidden="true">#</a> resourcemanager-service</h2><div class="language-yaml line-numbers-mode" data-ext="yml"><pre class="language-yaml"><code><span class="token key atrule">apiVersion</span><span class="token punctuation">:</span> v1
<span class="token key atrule">kind</span><span class="token punctuation">:</span> Service
<span class="token key atrule">metadata</span><span class="token punctuation">:</span>
  <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>service
  <span class="token key atrule">labels</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> resourcemanager
<span class="token key atrule">spec</span><span class="token punctuation">:</span>
  <span class="token key atrule">ports</span><span class="token punctuation">:</span>
    <span class="token punctuation">-</span> <span class="token key atrule">port</span><span class="token punctuation">:</span> <span class="token number">8088</span>
      <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>web
      <span class="token key atrule">targetPort</span><span class="token punctuation">:</span> <span class="token number">8088</span>
      <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP

    <span class="token punctuation">-</span> <span class="token key atrule">port</span><span class="token punctuation">:</span> <span class="token number">19888</span>
      <span class="token key atrule">name</span><span class="token punctuation">:</span> resourcemanager<span class="token punctuation">-</span>history<span class="token punctuation">-</span>web
      <span class="token key atrule">targetPort</span><span class="token punctuation">:</span> <span class="token number">19888</span>
      <span class="token key atrule">protocol</span><span class="token punctuation">:</span> TCP

  <span class="token key atrule">clusterIP</span><span class="token punctuation">:</span> None
  <span class="token key atrule">selector</span><span class="token punctuation">:</span>
    <span class="token key atrule">app</span><span class="token punctuation">:</span> resourcemanager
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,11),l=[p];function c(i,o){return a(),s("div",null,l)}const r=n(t,[["render",c],["__file","hadoop-network.html.vue"]]);export{r as default};
