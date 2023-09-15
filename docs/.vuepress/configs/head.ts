import type { HeadConfig } from '@vuepress/core'

export const head: HeadConfig[] = [
    ['meta', { name: 'application-name', content: 'Component' }],
    ['meta', { name: 'apple-mobile-web-app-title', content: 'Component' }],
    ['link', { rel: 'icon', href: '/images/logo-black.png' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
]