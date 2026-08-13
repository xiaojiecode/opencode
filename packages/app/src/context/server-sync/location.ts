import type { OpenCodeEvent, ShellInfo } from "@opencode-ai/client/promise"
import type { QueryClient } from "@tanstack/solid-query"
import { pathKey, type PathKey } from "@/utils/path-key"
import type { ServerScope } from "@/utils/server-scope"

export function createLocationSync(input: {
  scope: ServerScope
  queryClient: QueryClient
  active: () => PathKey[]
  info: (directory: PathKey) => Promise<unknown>
  vcs: (directory: PathKey) => Promise<unknown>
  skill: (directory: PathKey) => Promise<unknown>
  websearch: (directory: PathKey) => Promise<unknown>
  shell: (directory: PathKey) => Promise<ShellInfo[]>
}) {
  function main(event: OpenCodeEvent, directory: string) {
    if (event.type === "server.connected") {
      void refreshActive()
      return
    }
    if (directory === "global") return
    const key = pathKey(directory)

    if (event.type === "skill.updated") void refreshSkill(key)
    if (event.type === "config.updated" || event.type === "websearch.updated") void refreshWebsearch(key)
    if (event.type === "shell.created") rememberShell(key, event.data.info)
    if (event.type === "shell.exited" || event.type === "shell.deleted") forgetShell(key, event.data.id)
  }

  function refreshActive() {
    return Promise.all(
      input
        .active()
        .flatMap((directory) => [
          refreshInfo(directory),
          refreshVcs(directory),
          refreshSkill(directory),
          refreshWebsearch(directory),
          refreshShell(directory),
        ]),
    ).then(() => undefined)
  }

  async function refreshInfo(directory: PathKey) {
    input.queryClient.setQueryData(infoKey(directory), await input.info(directory))
  }

  async function refreshVcs(directory: PathKey) {
    input.queryClient.setQueryData(vcsKey(directory), await input.vcs(directory))
  }

  async function refreshSkill(directory: PathKey) {
    input.queryClient.setQueryData(skillKey(directory), await input.skill(directory))
  }

  async function refreshWebsearch(directory: PathKey) {
    input.queryClient.setQueryData(websearchKey(directory), await input.websearch(directory))
  }

  async function refreshShell(directory: PathKey) {
    input.queryClient.setQueryData(shellKey(directory), await input.shell(directory))
  }

  function rememberShell(directory: PathKey, shell: ShellInfo) {
    input.queryClient.setQueryData<ShellInfo[]>(shellKey(directory), (current = []) => [
      ...current.filter((item) => item.id !== shell.id),
      shell,
    ])
  }

  function forgetShell(directory: PathKey, shellID: string) {
    input.queryClient.setQueryData<ShellInfo[]>(shellKey(directory), (current = []) =>
      current.filter((item) => item.id !== shellID),
    )
  }

  const skillKey = (directory: PathKey) => [input.scope, directory, "skills"] as const
  const infoKey = (directory: PathKey) => [input.scope, directory, "path"] as const
  const vcsKey = (directory: PathKey) => [input.scope, directory, "vcs"] as const
  const websearchKey = (directory: PathKey) => [input.scope, directory, "websearch"] as const
  const shellKey = (directory: PathKey) => [input.scope, directory, "shell"] as const

  return { main }
}
