import { createContext, useContext } from 'react'

export interface UiActions {
  editTransaction: (id: string) => void
  deleteTransaction: (id: string) => void
  editAccount: (id: string) => void
  deleteAccount: (id: string) => void
  editPlan: (id: string) => void
  deletePlan: (id: string) => void
  editItem: (id: string) => void
  deleteItem: (id: string) => void
  unpayItem: (id: string) => void
}

export const UiActionsContext = createContext<UiActions | null>(null)

export function useUiActions(): UiActions | null {
  return useContext(UiActionsContext)
}
