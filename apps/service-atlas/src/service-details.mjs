function escapeMarkup(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isWebAddress(address) {
  try {
    const protocol = new URL(address).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function renderCopyButton(value, label) {
  return `<button class="service-details__copy" type="button" data-copy="${escapeMarkup(value)}" aria-label="复制${escapeMarkup(label)}">复制</button>`;
}

function renderEndpoints(endpoints = []) {
  if (endpoints.length === 0) return "";

  const items = endpoints.map((endpoint) => {
    const address = escapeMarkup(endpoint.address);
    const addressMarkup = isWebAddress(endpoint.address)
      ? `<a href="${address}" target="_blank" rel="noopener noreferrer">${address}</a>`
      : `<code>${address}</code>`;
    const badges = [
      endpoint.protocol
        ? `<span class="service-details__badge">${escapeMarkup(endpoint.protocol)}</span>`
        : "",
      endpoint.default
        ? '<span class="service-details__badge service-details__badge--default">默认</span>'
        : "",
    ].join("");

    return `<li class="service-details__endpoint">
      <div class="service-details__row">
        <strong>${escapeMarkup(endpoint.name)}</strong>
        <span class="service-details__badges">${badges}</span>
      </div>
      <div class="service-details__address">${addressMarkup}${renderCopyButton(endpoint.address, `${endpoint.name}地址`)}</div>
      ${endpoint.description ? `<p>${escapeMarkup(endpoint.description)}</p>` : ""}
    </li>`;
  }).join("");

  return `<section class="service-details__section">
    <h3>访问方式</h3>
    <ul class="service-details__list">${items}</ul>
  </section>`;
}

function renderCredentials(credentials = []) {
  if (credentials.length === 0) return "";

  const items = credentials.map((credential) => `<li class="service-details__credential">
    <strong>${escapeMarkup(credential.name)}</strong>
    ${credential.login ? `<p class="service-details__login">${escapeMarkup(credential.login)}</p>` : ""}
    ${credential.username ? `<div class="service-details__secret"><span>账号</span><code>${escapeMarkup(credential.username)}</code>${renderCopyButton(credential.username, `${credential.name}账号`)}</div>` : ""}
    ${credential.password ? `<div class="service-details__secret"><span>密码</span><code>${escapeMarkup(credential.password)}</code>${renderCopyButton(credential.password, `${credential.name}密码`)}</div>` : ""}
    ${credential.groups?.length ? `<div class="service-details__groups"><span>所需组</span><ul>${credential.groups.map((group) => `<li>${escapeMarkup(group)}</li>`).join("")}</ul></div>` : ""}
    ${credential.source ? `<div class="service-details__source"><span>来源</span><p>${escapeMarkup(credential.source)}</p></div>` : ""}
  </li>`).join("");

  return `<section class="service-details__section">
    <h3>登录与凭据</h3>
    <ul class="service-details__list service-details__list--credentials">${items}</ul>
  </section>`;
}

export function renderServiceDetails(service) {
  const description = service.description
    ? `<p class="service-details__description">${escapeMarkup(service.description)}</p>`
    : '<p class="service-details__description service-details__description--muted">暂无补充说明。</p>';
  const defaultLink = service.href
    ? `<a class="service-details__open" href="${escapeMarkup(service.href)}" target="_blank" rel="noopener noreferrer">打开默认入口 <span aria-hidden="true">↗</span></a>`
    : '<span class="service-details__no-entry">未配置 Web 跳转入口</span>';

  return `<div class="service-details__accent" style="--service-accent:${escapeMarkup(service.color ?? "#63cbbf")}"></div>
    <header class="service-details__header">
      <span class="service-details__eyebrow">服务详情</span>
      <h2 id="service-details-title">${escapeMarkup(service.name)}</h2>
    </header>
    ${description}
    ${renderEndpoints(service.endpoints)}
    ${renderCredentials(service.credentials)}
    <footer class="service-details__footer">${defaultLink}</footer>`;
}
