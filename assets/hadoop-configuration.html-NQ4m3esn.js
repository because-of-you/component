import{_ as r,r as i,o as d,c as u,a as n,b as e,w as l,d as t,e as c}from"./app-STO-5Cne.js";const o={},v={class:"table-of-contents"},p=c(`<h2 id="说明" tabindex="-1"><a class="header-anchor" href="#说明" aria-hidden="true">#</a> 说明</h2><p>含有五个配置文件，如下表格：</p><table><thead><tr><th>文件名称</th><th>说明</th></tr></thead><tbody><tr><td>entrypoint.sh</td><td>一个简单的启动脚本</td></tr><tr><td>core-site.xml</td><td>一个简单的core-site.xml</td></tr><tr><td>hdfs-site.xml</td><td>一个简单的hdfs-site.xml</td></tr><tr><td>mapred-site.xml</td><td>一个简单的mapred-site.xml</td></tr><tr><td>yarn-site.xml</td><td>一个简单的yarn-site.xml</td></tr></tbody></table><h2 id="配置文件内容示例" tabindex="-1"><a class="header-anchor" href="#配置文件内容示例" aria-hidden="true">#</a> 配置文件内容示例</h2><div class="language-yaml line-numbers-mode" data-ext="yml"><pre class="language-yaml"><code><span class="token key atrule">apiVersion</span><span class="token punctuation">:</span> v1
<span class="token key atrule">kind</span><span class="token punctuation">:</span> ConfigMap
<span class="token key atrule">metadata</span><span class="token punctuation">:</span>
  <span class="token key atrule">name</span><span class="token punctuation">:</span> hadoop<span class="token punctuation">-</span>configmap
<span class="token key atrule">data</span><span class="token punctuation">:</span>

  <span class="token key atrule">entrypoint.sh</span><span class="token punctuation">:</span> <span class="token punctuation">|</span><span class="token scalar string">
    #!/usr/bin/env bash</span>
    
    <span class="token comment"># 设置环境变量</span>
    HADOOP_HOME=$<span class="token punctuation">{</span>HADOOP_HOME<span class="token punctuation">-</span><span class="token string">&quot;/opt/component/hadoop&quot;</span><span class="token punctuation">}</span>
    export HADOOP_HOME=$HADOOP_HOME
    echo &quot;export HADOOP_HOME=$HADOOP_HOME&quot; <span class="token punctuation">&gt;</span><span class="token punctuation">&gt;</span> /etc/profile
    echo &quot;export PATH=$PATH<span class="token punctuation">:</span>$HADOOP_HOME/bin&quot; <span class="token punctuation">&gt;</span><span class="token punctuation">&gt;</span> /etc/profile
    echo &quot;export HADOOP_HOME=$HADOOP_HOME&quot; <span class="token punctuation">&gt;</span><span class="token punctuation">&gt;</span> /root/.bashrc
    echo &quot;export PATH=$PATH<span class="token punctuation">:</span>$HADOOP_HOME/bin&quot; <span class="token punctuation">&gt;</span><span class="token punctuation">&gt;</span> /root/.bashrc
    
    source /etc/profile
    
    <span class="token comment"># 保证网络加入正常 防止启动过快</span>
    sleep 5s
    
    <span class="token comment"># namenode 格式化</span>
    HDFS_META_HOME=/opt/component/storage/hadoop
    if <span class="token punctuation">[</span> <span class="token punctuation">-</span>z &quot;$(ls <span class="token punctuation">-</span>A $<span class="token punctuation">{</span>HDFS_META_HOME<span class="token punctuation">}</span>)&quot; <span class="token punctuation">]</span> <span class="token important">&amp;&amp;</span> <span class="token punctuation">[</span><span class="token punctuation">[</span> &quot;$(echo &quot;$@&quot; <span class="token punctuation">|</span> grep &quot;namenode&quot;)&quot; <span class="token tag">!=</span> &quot;&quot; <span class="token punctuation">]</span><span class="token punctuation">]</span>; then
      echo &quot;hdfs namenode <span class="token punctuation">-</span>format&quot; 
      hdfs namenode <span class="token punctuation">-</span>format
    fi
    
    echo &quot;$@&quot;
    exec &quot;$@&quot;

  <span class="token key atrule">core-site.xml</span><span class="token punctuation">:</span> <span class="token punctuation">|</span><span class="token scalar string">  
    &lt;!-- core-site.xml 文件内容 --&gt;
    &lt;configuration&gt;
        &lt;property&gt;
            &lt;name&gt;fs.defaultFS&lt;/name&gt;
            &lt;value&gt;hdfs://namenode-service&lt;/value&gt;
        &lt;/property&gt; 
        &lt;property&gt;
            &lt;name&gt;hadoop.tmp.dir&lt;/name&gt;
            &lt;value&gt;/opt/component/storage/hadoop/temporarily&lt;/value&gt;
        &lt;/property&gt;  
        &lt;property&gt;
            &lt;name&gt;hadoop.proxyuser.root.hosts&lt;/name&gt;
            &lt;value&gt;*&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
            &lt;name&gt;hadoop.proxyuser.root.groups&lt;/name&gt;
            &lt;value&gt;*&lt;/value&gt;
        &lt;/property&gt;
    &lt;/configuration&gt;    </span>

  <span class="token key atrule">hdfs-site.xml</span><span class="token punctuation">:</span> <span class="token punctuation">|</span><span class="token scalar string">
    &lt;!-- hdfs-site.xml 文件内容 --&gt;
    &lt;configuration&gt;
        &lt;property&gt;
            &lt;name&gt;dfs.namenode.name.dir&lt;/name&gt;
            &lt;value&gt;file:/opt/component/storage/hadoop/namenode&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
            &lt;name&gt;dfs.datanode.data.dir&lt;/name&gt;
            &lt;value&gt;file:/opt/component/storage/hadoop/datanode&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
            &lt;name&gt;dfs.replication&lt;/name&gt;
            &lt;value&gt;2&lt;/value&gt;
        &lt;/property&gt;
    &lt;/configuration&gt;</span>

  <span class="token key atrule">mapred-site.xml</span><span class="token punctuation">:</span> <span class="token punctuation">|</span><span class="token scalar string">
    &lt;!-- mapred-site.xml 文件内容 --&gt;
    &lt;configuration&gt;
        &lt;property&gt;
            &lt;!--指定Mapreduce运行在yarn上--&gt;
            &lt;name&gt;mapreduce.framework.name&lt;/name&gt;
            &lt;value&gt;yarn&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
          &lt;name&gt;yarn.app.mapreduce.am.env&lt;/name&gt;
          &lt;value&gt;HADOOP_MAPRED_HOME=\${HADOOP_HOME}&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
          &lt;name&gt;mapreduce.map.env&lt;/name&gt;
          &lt;value&gt;HADOOP_MAPRED_HOME=\${HADOOP_HOME}&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
          &lt;name&gt;mapreduce.reduce.env&lt;/name&gt;
          &lt;value&gt;HADOOP_MAPRED_HOME=\${HADOOP_HOME}&lt;/value&gt;
        &lt;/property&gt;    
        &lt;property&gt;
            &lt;name&gt;mapreduce.map.memory.mb&lt;/name&gt;
            &lt;value&gt;1024&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
            &lt;name&gt;mapreduce.map.java.opts&lt;/name&gt;
            &lt;value&gt;-Xms819m -Xmx819m&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
            &lt;name&gt;mapreduce.reduce.memory.mb&lt;/name&gt;
            &lt;value&gt;2048&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
            &lt;name&gt;mapreduce.reduce.java.opts&lt;/name&gt;
            &lt;value&gt;-Xms1638m -Xmx1638m&lt;/value&gt;
        &lt;/property&gt;
    &lt;/configuration&gt;</span>

  <span class="token key atrule">yarn-site.xml</span><span class="token punctuation">:</span> <span class="token punctuation">|</span><span class="token scalar string">
    &lt;!-- yarn-site.xml 文件内容 --&gt;
    &lt;configuration&gt;
        &lt;property&gt;
            &lt;name&gt;yarn.nodemanager.aux-services&lt;/name&gt;
            &lt;value&gt;mapreduce_shuffle&lt;/value&gt;
        &lt;/property&gt;    
        &lt;property&gt;
            &lt;name&gt;yarn.resourcemanager.hostname&lt;/name&gt;
            &lt;value&gt;resourcemanager-service&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
            &lt;name&gt;yarn.scheduler.minimum-allocation-mb&lt;/name&gt;
            &lt;value&gt;1024&lt;/value&gt;
        &lt;/property&gt;    
        &lt;property&gt;
            &lt;name&gt;yarn.scheduler.maximum-allocation-mb&lt;/name&gt;
            &lt;value&gt;3072&lt;/value&gt;
        &lt;/property&gt;    
        &lt;property&gt;
          &lt;name&gt;yarn.app.mapreduce.am.resource.mb&lt;/name&gt;
          &lt;value&gt;2048&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
          &lt;name&gt;arn.app.mapreduce.am.command-opts&lt;/name&gt;
          &lt;value&gt;-Xms1638m -Xmx1638m&lt;/value&gt;
        &lt;/property&gt;    
        &lt;property&gt;
            &lt;name&gt;yarn.nodemanager.resource.memory-mb&lt;/name&gt;
            &lt;value&gt;3072&lt;/value&gt;
        &lt;/property&gt;
        &lt;property&gt;
          &lt;name&gt;yarn.resourcemanager.address&lt;/name&gt;
          &lt;value&gt;resourcemanager-service&lt;/value&gt;
        &lt;/property&gt;    
        &lt;property&gt;
          &lt;name&gt;yarn.resourcemanager.scheduler.address&lt;/name&gt;
          &lt;value&gt;resourcemanager-service&lt;/value&gt;
        &lt;/property&gt;    
        &lt;property&gt;
          &lt;name&gt;yarn.resourcemanager.resource-tracker.address&lt;/name&gt;
          &lt;value&gt;resourcemanager-service&lt;/value&gt;
        &lt;/property&gt;
    &lt;/configuration&gt;
      </span>

</code></pre><div class="highlight-lines"><br><br><br><div class="highlight-line"> </div><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="参考" tabindex="-1"><a class="header-anchor" href="#参考" aria-hidden="true">#</a> 参考</h2>`,6),m={href:"https://docs.cloudera.com/HDPDocuments/HDP2/HDP-2.1.1/bk_installing_manually_book/content/rpm-chap1-11.html",target:"_blank",rel:"noopener noreferrer"},b={href:"https://developer.aliyun.com/article/5911",target:"_blank",rel:"noopener noreferrer"};function g(h,y){const a=i("router-link"),s=i("ExternalLinkIcon");return d(),u("div",null,[n("nav",v,[n("ul",null,[n("li",null,[e(a,{to:"#说明"},{default:l(()=>[t("说明")]),_:1})]),n("li",null,[e(a,{to:"#配置文件内容示例"},{default:l(()=>[t("配置文件内容示例")]),_:1})]),n("li",null,[e(a,{to:"#参考"},{default:l(()=>[t("参考")]),_:1})])])]),p,n("ul",null,[n("li",null,[n("a",m,[t("https://docs.cloudera.com/HDPDocuments/HDP2/HDP-2.1.1/bk_installing_manually_book/content/rpm-chap1-11.html"),e(s)])]),n("li",null,[n("a",b,[t("https://developer.aliyun.com/article/5911"),e(s)])])])])}const _=r(o,[["render",g],["__file","hadoop-configuration.html.vue"]]);export{_ as default};
