import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WorkspaceSearchResult } from '../../../../shared/types'
import type { TabDocument, TabState } from '../../features/tabs/types'
import type { EditorMode } from '../../modules/editor/model/types'
import {
  findTextSearchMatches,
  normalizeSearchQuery,
  replaceTextSearchMatches
} from '../../modules/editor/services/documentSearch'
import { Modal, Toast } from '../../ui'
import type { TitleBarSearchResult, TitleBarSearchScope } from '../TitleBar'
import { buildTitlebarSearchResults, flattenWorkspaceSearchResults } from './searchResults'
import { isPathInsideWorkspace } from './paths'

interface TitleBarSearchDeps {
  documentContent: string
  workspaceRoot: string | null
  workspaceAvailable: boolean
  tabs: TabState[]
  openEditorView: () => void
  openPath: (path: string, options?: { mode?: EditorMode }) => Promise<boolean>
  setEditorMode: (mode: EditorMode) => void
  setContent: (content: string) => void
  findTabByPath: (path: string) => TabState | undefined
  updateTabDocument: (tabId: string, document: Partial<TabDocument>) => void
}

/**
 * Everything the title-bar search needs: query state, workspace-wide search,
 * navigation between hits and the two replace flows.
 *
 * Extracted from MainLayout so the replace paths (which touch tabs, disk and
 * the editor in one go) can be read — and later tested — in isolation.
 */
export interface TitleBarSearchApi {
  searchQuery: string
  searchScope: TitleBarSearchScope
  searchCaseSensitive: boolean
  replaceValue: string
  setReplaceValue: (value: string) => void
  replaceVisible: boolean
  setReplaceVisible: (visible: boolean) => void
  activeSearchResultIndex: number
  activeSearchMatchIndex: number
  searchFocusRequestId: number
  searchNavigationRequestId: number
  workspaceSearchResult: WorkspaceSearchResult | null
  workspaceSearchLoading: boolean
  workspaceSearchError: string | undefined
  searchResultSummary: { totalCount: number; items: TitleBarSearchResult[] }
  workspaceSearchResults: TitleBarSearchResult[]
  titlebarSearchResults: TitleBarSearchResult[]
  titlebarSearchTruncated: boolean
  activeSearchOrdinal: number
  searchResultsForNavigation: TitleBarSearchResult[]
  workspaceSearchDisabledError: string | undefined
  effectiveSearchMatchCount: number
  triggerDocumentSearch: () => void
  clearWorkspaceSearch: () => void
  updateSearchQuery: (value: string) => void
  updateSearchScope: (scope: TitleBarSearchScope) => void
  updateSearchCaseSensitive: (caseSensitive: boolean) => void
  updateSearchMatchCount: (count: number) => void
  navigateToSearchResult: (result: TitleBarSearchResult) => Promise<void>
  stepSearchMatch: (direction: 1 | -1) => void
  selectSearchMatch: (result: TitleBarSearchResult) => void
  replaceCurrentSearchMatch: () => void
  replaceAllSearchMatches: () => Promise<void>
}
export function useTitleBarSearch(deps: TitleBarSearchDeps): TitleBarSearchApi {
  const {
    documentContent,
    workspaceRoot,
    workspaceAvailable,
    tabs,
    openEditorView,
    openPath,
    setEditorMode,
    setContent,
    findTabByPath,
    updateTabDocument
  } = deps

  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<TitleBarSearchScope>('document')
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false)
  const [replaceValue, setReplaceValue] = useState('')
  const [replaceVisible, setReplaceVisible] = useState(false)
  const [, setSearchMatchCount] = useState(0)
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0)
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0)
  const [searchFocusRequestId, setSearchFocusRequestId] = useState(0)
  const [searchNavigationRequestId, setSearchNavigationRequestId] = useState(0)
  const [workspaceSearchResult, setWorkspaceSearchResult] = useState<WorkspaceSearchResult | null>(
    null
  )
  const [workspaceSearchLoading, setWorkspaceSearchLoading] = useState(false)
  const [workspaceSearchError, setWorkspaceSearchError] = useState<string | undefined>(undefined)

  const searchResultSummary = useMemo(
    () => buildTitlebarSearchResults(documentContent, searchQuery, searchCaseSensitive),
    [documentContent, searchCaseSensitive, searchQuery]
  )
  const workspaceSearchResults = useMemo(
    () => flattenWorkspaceSearchResults(workspaceSearchResult),
    [workspaceSearchResult]
  )
  const titlebarSearchResults =
    searchScope === 'workspace' ? workspaceSearchResults : searchResultSummary.items
  const effectiveSearchMatchCount =
    searchScope === 'workspace'
      ? (workspaceSearchResult?.totalCount ?? 0)
      : searchResultSummary.totalCount
  const titlebarSearchTruncated =
    searchScope === 'workspace'
      ? Boolean(workspaceSearchResult?.truncated)
      : searchResultSummary.totalCount > searchResultSummary.items.length
  const activeSearchOrdinal =
    searchQuery && effectiveSearchMatchCount > 0
      ? Math.min(activeSearchResultIndex, effectiveSearchMatchCount - 1) + 1
      : 0
  const searchResultsForNavigation = titlebarSearchResults
  const workspaceSearchDisabledError =
    searchScope === 'workspace' && !workspaceAvailable ? '先打开一个工作区' : undefined

  const triggerDocumentSearch = useCallback((): void => {
    openEditorView()
    setSearchFocusRequestId((current) => current + 1)
  }, [openEditorView])

  /** Any query/scope/case change invalidates workspace hits. */
  const resetSearchResults = useCallback((): void => {
    setSearchMatchCount(0)
    setActiveSearchResultIndex(0)
    setActiveSearchMatchIndex(0)
    setWorkspaceSearchResult(null)
    setWorkspaceSearchError(undefined)
    setWorkspaceSearchLoading(false)
  }, [])

  /** Used when the workspace changes: workspace hits are no longer valid. */
  const clearWorkspaceSearch = useCallback((): void => {
    setWorkspaceSearchLoading(false)
    setWorkspaceSearchError(undefined)
    setWorkspaceSearchResult(null)
  }, [])

  const updateSearchQuery = useCallback(
    (value: string): void => {
      setSearchQuery(value)
      resetSearchResults()
    },
    [resetSearchResults]
  )

  const updateSearchScope = useCallback(
    (scope: TitleBarSearchScope): void => {
      setSearchScope(scope)
      resetSearchResults()
    },
    [resetSearchResults]
  )

  const updateSearchCaseSensitive = useCallback(
    (caseSensitive: boolean): void => {
      setSearchCaseSensitive(caseSensitive)
      resetSearchResults()
    },
    [resetSearchResults]
  )

  const updateSearchMatchCount = useCallback((count: number): void => {
    setSearchMatchCount(count)
    setActiveSearchMatchIndex((current) => (count === 0 ? 0 : Math.min(current, count - 1)))
  }, [])

  // Workspace-wide search, debounced. The document scope is derived inline.
  useEffect(() => {
    const normalizedQuery = normalizeSearchQuery(searchQuery)

    if (searchScope !== 'workspace' || !normalizedQuery || !workspaceRoot) {
      return
    }

    let cancelled = false

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return
      }

      setWorkspaceSearchLoading(true)
      setWorkspaceSearchError(undefined)
      setWorkspaceSearchResult(null)

      window.api.workspace
        .search({
          rootPath: workspaceRoot,
          query: normalizedQuery,
          caseSensitive: searchCaseSensitive
        })
        .then((result) => {
          if (cancelled) {
            return
          }

          if (result.ok) {
            setWorkspaceSearchResult(result.data)
            setActiveSearchResultIndex((current) =>
              result.data.totalCount === 0 ? 0 : Math.min(current, result.data.totalCount - 1)
            )
          } else {
            setWorkspaceSearchResult(null)
            setWorkspaceSearchError(result.error.message)
          }
        })
        .finally(() => {
          if (!cancelled) {
            setWorkspaceSearchLoading(false)
          }
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchCaseSensitive, searchQuery, searchScope, workspaceRoot])

  const navigateToSearchResult = useCallback(
    async (result: TitleBarSearchResult): Promise<void> => {
      openEditorView()

      if (result.scope === 'workspace' && result.path) {
        const opened = await openPath(result.path, { mode: 'source' })

        if (!opened) {
          return
        }
      } else {
        setEditorMode('source')
      }

      setActiveSearchResultIndex(result.index)
      setActiveSearchMatchIndex(result.matchIndex)
      setSearchNavigationRequestId((current) => current + 1)
    },
    [openEditorView, openPath, setEditorMode]
  )

  const stepSearchMatch = useCallback(
    (direction: 1 | -1): void => {
      if (searchScope === 'workspace') {
        const visibleResultCount = searchResultsForNavigation.length

        if (visibleResultCount === 0) {
          setSearchFocusRequestId((current) => current + 1)
          return
        }

        const nextIndex =
          (activeSearchResultIndex + direction + visibleResultCount) % visibleResultCount
        const nextResult = searchResultsForNavigation[nextIndex]

        if (nextResult) {
          void navigateToSearchResult(nextResult)
        }
        return
      }

      const matchCount = searchResultSummary.totalCount

      if (matchCount === 0) {
        setSearchFocusRequestId((current) => current + 1)
        return
      }

      const nextIndex = (activeSearchResultIndex + direction + matchCount) % matchCount
      openEditorView()
      setEditorMode('source')
      setActiveSearchResultIndex(nextIndex)
      setActiveSearchMatchIndex(nextIndex)
      setSearchNavigationRequestId((current) => current + 1)
    },
    [
      activeSearchResultIndex,
      navigateToSearchResult,
      openEditorView,
      searchResultSummary.totalCount,
      searchResultsForNavigation,
      searchScope,
      setEditorMode
    ]
  )

  const selectSearchMatch = useCallback(
    (result: TitleBarSearchResult): void => {
      void navigateToSearchResult(result)
    },
    [navigateToSearchResult]
  )

  const replaceCurrentSearchMatch = useCallback((): void => {
    const normalizedQuery = normalizeSearchQuery(searchQuery)

    if (!normalizedQuery) {
      setSearchFocusRequestId((current) => current + 1)
      return
    }

    if (searchScope === 'workspace') {
      Toast.warning('工作区范围请使用全部替换')
      return
    }

    const matches = findTextSearchMatches(documentContent, normalizedQuery, {
      caseSensitive: searchCaseSensitive
    })

    if (matches.length === 0) {
      setSearchFocusRequestId((current) => current + 1)
      return
    }

    const matchIndex = Math.min(activeSearchMatchIndex, matches.length - 1)
    const match = matches[matchIndex]
    const nextContent = replaceTextSearchMatches(documentContent, [match], replaceValue)
    const nextMatches = findTextSearchMatches(nextContent, normalizedQuery, {
      caseSensitive: searchCaseSensitive
    })
    const nextIndex = nextMatches.length === 0 ? 0 : Math.min(matchIndex, nextMatches.length - 1)

    openEditorView()
    setEditorMode('source')
    setContent(nextContent)
    setActiveSearchResultIndex(nextIndex)
    setActiveSearchMatchIndex(nextIndex)
    setSearchNavigationRequestId((current) => current + 1)
    Toast.success('已替换 1 处')
  }, [
    activeSearchMatchIndex,
    documentContent,
    openEditorView,
    replaceValue,
    searchCaseSensitive,
    searchQuery,
    searchScope,
    setContent,
    setEditorMode
  ])

  const replaceAllSearchMatches = useCallback(async (): Promise<void> => {
    const normalizedQuery = normalizeSearchQuery(searchQuery)

    if (!normalizedQuery) {
      setSearchFocusRequestId((current) => current + 1)
      return
    }

    if (searchScope !== 'workspace') {
      const matches = findTextSearchMatches(documentContent, normalizedQuery, {
        caseSensitive: searchCaseSensitive
      })

      if (matches.length === 0) {
        setSearchFocusRequestId((current) => current + 1)
        return
      }

      openEditorView()
      setEditorMode('source')
      setContent(replaceTextSearchMatches(documentContent, matches, replaceValue))
      setActiveSearchResultIndex(0)
      setActiveSearchMatchIndex(0)
      setSearchNavigationRequestId((current) => current + 1)
      Toast.success(`已替换 ${matches.length} 处`)
      return
    }

    if (!workspaceRoot) {
      Toast.error('先打开一个工作区')
      return
    }

    const dirtyWorkspaceTabs = tabs.filter(
      (tab) =>
        tab.document.dirty &&
        tab.document.path &&
        isPathInsideWorkspace(tab.document.path, workspaceRoot)
    )
    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '替换整个工作区匹配项？',
        content:
          dirtyWorkspaceTabs.length > 0
            ? `将按磁盘文件替换 ${effectiveSearchMatchCount} 处匹配，并刷新已打开的命中文件。${dirtyWorkspaceTabs.length} 个未保存标签可能被磁盘内容覆盖。`
            : `将按磁盘文件替换 ${effectiveSearchMatchCount} 处匹配。`,
        okText: '全部替换',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })

    if (!confirmed) {
      return
    }

    const result = await window.api.workspace.replaceAll({
      rootPath: workspaceRoot,
      query: normalizedQuery,
      replacement: replaceValue,
      caseSensitive: searchCaseSensitive
    })

    if (!result.ok) {
      Toast.error(result.error.message)
      return
    }

    // Refresh any tab whose file was rewritten on disk.
    for (const file of result.data.files) {
      const openTab = findTabByPath(file.path)

      if (!openTab) {
        continue
      }

      const documentResult = await window.api.document.openPath(file.path)

      if (documentResult.ok) {
        updateTabDocument(openTab.id, {
          path: documentResult.data.path,
          title: documentResult.data.title,
          content: documentResult.data.content,
          dirty: false,
          updatedAt: documentResult.data.updatedAt
        })
      }
    }

    const searchResult = await window.api.workspace.search({
      rootPath: workspaceRoot,
      query: normalizedQuery,
      caseSensitive: searchCaseSensitive
    })

    if (searchResult.ok) {
      setWorkspaceSearchResult(searchResult.data)
    }

    setActiveSearchResultIndex(0)
    setActiveSearchMatchIndex(0)
    Toast.success(`已替换 ${result.data.replacements} 处，涉及 ${result.data.changedFiles} 个文件`)
  }, [
    documentContent,
    effectiveSearchMatchCount,
    findTabByPath,
    openEditorView,
    replaceValue,
    searchCaseSensitive,
    searchQuery,
    searchScope,
    setContent,
    setEditorMode,
    tabs,
    updateTabDocument,
    workspaceRoot
  ])

  return {
    searchQuery,
    searchScope,
    searchCaseSensitive,
    replaceValue,
    setReplaceValue,
    replaceVisible,
    setReplaceVisible,
    activeSearchResultIndex,
    activeSearchMatchIndex,
    searchFocusRequestId,
    searchNavigationRequestId,
    workspaceSearchResult,
    workspaceSearchLoading,
    workspaceSearchError,
    searchResultSummary,
    workspaceSearchResults,
    titlebarSearchResults,
    titlebarSearchTruncated,
    activeSearchOrdinal,
    searchResultsForNavigation,
    workspaceSearchDisabledError,
    effectiveSearchMatchCount,
    triggerDocumentSearch,
    clearWorkspaceSearch,
    updateSearchQuery,
    updateSearchScope,
    updateSearchCaseSensitive,
    updateSearchMatchCount,
    navigateToSearchResult,
    stepSearchMatch,
    selectSearchMatch,
    replaceCurrentSearchMatch,
    replaceAllSearchMatches
  }
}
