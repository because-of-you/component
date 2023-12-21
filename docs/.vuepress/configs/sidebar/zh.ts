import type { SidebarConfig } from '@vuepress/theme-default'

export const sidebarZh: SidebarConfig = {
    '/guide/': [
        {
            text: '指南',
            children: [
                '/guide/getting-started.md',
                '/guide/source.md',
                '/guide/hadoop.md',
                '/guide/hadoop-configuration.md',
                '/guide/hadoop-network.md',
                '/guide/hadoop-statefulset.md',
            ],
        },
    ],
}