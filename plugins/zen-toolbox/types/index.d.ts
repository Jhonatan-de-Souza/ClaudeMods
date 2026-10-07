export type Panel = 'main' | 'zen' | 'themes' | 'mode'

export type ZenTheme = 'blue' | 'dark' | 'light' | 'green' | 'rainbow' | 'custom'

export type ZenColors = { bar: string; text: string; border: string }

export type StepStatus = 'pending' | 'in_progress' | 'completed'

export type ZenStep = { id: string; text: string; status: StepStatus }

export type ZenTask = {
  title: string
  startedAt: number
  doneAt: number | null
  steps: ZenStep[]
}

export type ThemeEntry = { slug: string; name: string }

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

declare module 'claude-code' {
  interface PluginState {
    'zen-toolbox': {
      menu: Panel | null
      zenOn: boolean
      zenTheme: ZenTheme
      zenCustom: ZenColors
      zenCollapsed: boolean
      task: ZenTask | null
      now: number
      themes: ThemeEntry[]
      themeName: string | null
      themeQuery: string
      themeStatus: string
      effort: Effort | null
      mode: string | null
      defaultMode: string | null
      preview: string | null
      isDownloading: boolean
    }
  }
}
