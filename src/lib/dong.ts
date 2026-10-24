import type { DongEvent, DongPotDeposit } from '../types'

/** Payer id used when an expense is paid from the shared pot, not by a member. */
export const MADRE_KHARJ_PAYER_ID = '__madre_kharj__'

export const MADRE_KHARJ_NAME = 'مادرخرج'

export interface SettlementTransfer {
  id: string
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
  settled: boolean
}

export interface DongParticipantBalance {
  id: string
  name: string
  /** Expenses this member paid personally. */
  paid: number
  /** Pot money from this member: setup amount plus later deposits. */
  deposits: number
  /** Rials the مسئول covered because the pot was short. */
  deficitCovered: number
  share: number
  /** paid + deposits + deficitCovered − share. Positive means creditor. */
  net: number
}

export interface DongGroupBalance {
  id: string
  name: string
  memberIds: string[]
  paid: number
  deposits: number
  deficitCovered: number
  share: number
  net: number
  memberBalances: DongParticipantBalance[]
}

export interface PotLedgerEntry {
  id: string
  kind: 'contribution' | 'deposit' | 'expense'
  date: string
  title: string
  detail: string
  amount: number
  signed: number
  runningBalance: number
}

export interface DongCalculationSummary {
  transfers: SettlementTransfer[]
  balances: DongParticipantBalance[]
  groupBalances: DongGroupBalance[]
  ungroupedBalances: DongParticipantBalance[]
  groupTransfers: SettlementTransfer[]
  totalCost: number
  potActive: boolean
  potBalance: number
  totalDeposits: number
  potSpent: number
  responsibleId: string | null
  ledger: PotLedgerEntry[]
}

interface Party {
  id: string
  name: string
  remaining: number
}

export function emptyDongSummary(): DongCalculationSummary {
  return {
    transfers: [],
    balances: [],
    groupBalances: [],
    ungroupedBalances: [],
    groupTransfers: [],
    totalCost: 0,
    potActive: false,
    potBalance: 0,
    totalDeposits: 0,
    potSpent: 0,
    responsibleId: null,
    ledger: [],
  }
}

export function isMadreKharjEnabled(event: DongEvent): boolean {
  const madre = event.madreKharj
  if (!madre?.enabled || !madre.responsibleId) return false
  return event.participants.some((p) => p.id === madre.responsibleId)
}

export function hasPotPayments(event: DongEvent): boolean {
  return event.expenses.some((exp) => exp.paidById === MADRE_KHARJ_PAYER_ID && exp.amount > 0)
}

/** Pot math applies once مادرخرج is set, and also if older expenses were already paid from it. */
export function potAccountingActive(event: DongEvent): boolean {
  return isMadreKharjEnabled(event) || hasPotPayments(event)
}

export function defaultDongPayerId(event: DongEvent): string {
  if (isMadreKharjEnabled(event)) return MADRE_KHARJ_PAYER_ID
  return event.participants[0]?.id ?? ''
}

export function dongPayerLabel(event: DongEvent, paidById: string): string {
  if (paidById === MADRE_KHARJ_PAYER_ID) return MADRE_KHARJ_NAME
  return event.participants.find((p) => p.id === paidById)?.name || 'نامشخص'
}

export function memberHasPotRole(event: DongEvent, memberId: string): boolean {
  const madre = event.madreKharj
  if (!madre) return false
  if (madre.enabled && madre.responsibleId === memberId) return true
  if (Math.round(madre.contributions?.[memberId] ?? 0) > 0) return true
  return (madre.deposits ?? []).some((d) => d.memberId === memberId && d.amount > 0)
}

function positiveRials(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 0
  return Math.round(value)
}

function memberIds(event: DongEvent): Set<string> {
  return new Set(event.participants.map((p) => p.id))
}

function baseContribution(event: DongEvent, memberId: string, active: boolean): number {
  if (!active) return 0
  return positiveRials(event.madreKharj?.contributions?.[memberId])
}

function extraDeposits(event: DongEvent, memberId: string, active: boolean, known: Set<string>): number {
  if (!active || !known.has(memberId)) return 0
  let total = 0
  for (const deposit of event.madreKharj?.deposits ?? []) {
    if (deposit.memberId !== memberId) continue
    total += positiveRials(deposit.amount)
  }
  return total
}

function buildLedger(
  event: DongEvent,
  active: boolean,
  known: Set<string>,
): PotLedgerEntry[] {
  if (!active) return []
  const rows: PotLedgerEntry[] = []
  for (const participant of event.participants) {
    const amount = baseContribution(event, participant.id, true)
    if (amount <= 0) continue
    rows.push({
      id: `contrib_${participant.id}`,
      kind: 'contribution',
      date: event.date || '',
      title: participant.name,
      detail: 'مبلغ عضو به حساب مادرخرج',
      amount,
      signed: amount,
      runningBalance: 0,
    })
  }
  for (const deposit of event.madreKharj?.deposits ?? []) {
    if (!known.has(deposit.memberId)) continue
    const amount = positiveRials(deposit.amount)
    if (amount <= 0) continue
    const name = event.participants.find((p) => p.id === deposit.memberId)?.name ?? 'عضو'
    rows.push({
      id: deposit.id,
      kind: 'deposit',
      date: deposit.date || '',
      title: name,
      detail: deposit.note?.trim() || 'واریز بعدی',
      amount,
      signed: amount,
      runningBalance: 0,
    })
  }
  for (const exp of event.expenses) {
    if (exp.paidById !== MADRE_KHARJ_PAYER_ID || exp.amount <= 0) continue
    rows.push({
      id: exp.id,
      kind: 'expense',
      date: exp.date || '',
      title: exp.title,
      detail: 'خرج از مادرخرج',
      amount: exp.amount,
      signed: -exp.amount,
      runningBalance: 0,
    })
  }
  const kindOrder = { contribution: 0, deposit: 1, expense: 2 }
  rows.sort((a, b) => {
    const da = a.date || '9999-99-99'
    const db = b.date || '9999-99-99'
    if (da !== db) return da < db ? -1 : 1
    if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind]
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  let running = 0
  for (const row of rows) {
    running += row.signed
    row.runningBalance = running
  }
  return rows
}

function settleParties(
  debtors: Party[],
  creditors: Party[],
  settledSet: Set<string>,
  idFor: (fromId: string, toId: string) => string,
): SettlementTransfer[] {
  const dList = debtors.map((p) => ({ ...p })).sort((a, b) => b.remaining - a.remaining)
  const cList = creditors.map((p) => ({ ...p })).sort((a, b) => b.remaining - a.remaining)
  const transfers: SettlementTransfer[] = []
  let dIdx = 0
  let cIdx = 0
  while (dIdx < dList.length && cIdx < cList.length) {
    const debtor = dList[dIdx]
    const creditor = cList[cIdx]
    const pay = Math.min(debtor.remaining, creditor.remaining)
    if (pay >= 1) {
      const transferId = idFor(debtor.id, creditor.id)
      transfers.push({
        id: transferId,
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: Math.round(pay),
        settled: settledSet.has(transferId),
      })
    }
    debtor.remaining -= pay
    creditor.remaining -= pay
    if (debtor.remaining < 1) dIdx++
    if (creditor.remaining < 1) cIdx++
  }
  return transfers
}

function addPotParty(debtors: Party[], creditors: Party[], potBalance: number, responsibleKnown: boolean): void {
  if (potBalance > 5) {
    debtors.push({ id: MADRE_KHARJ_PAYER_ID, name: MADRE_KHARJ_NAME, remaining: potBalance })
  } else if (potBalance < -5 && !responsibleKnown) {
    creditors.push({ id: MADRE_KHARJ_PAYER_ID, name: MADRE_KHARJ_NAME, remaining: -potBalance })
  }
}

function allocateShares(expAmount: number, splits: string[], exp: DongEvent['expenses'][number]): Map<string, number> {
  const shares = new Map<string, number>()
  if (splits.length === 0 || expAmount <= 0) return shares
  if (exp.splitMode === 'custom' && exp.customShares) {
    let sumCustom = 0
    for (const id of splits) sumCustom += exp.customShares[id] ?? 0
    if (sumCustom > 0) {
      let allocated = 0
      splits.forEach((id, idx) => {
        if (idx === splits.length - 1) {
          shares.set(id, Math.max(0, expAmount - allocated))
        } else {
          const rawRatio = (exp.customShares![id] ?? 0) / sumCustom
          const share = Math.round(rawRatio * expAmount)
          allocated += share
          shares.set(id, share)
        }
      })
      return shares
    }
  }
  const count = splits.length
  const baseShare = Math.floor(expAmount / count)
  const remainder = expAmount % count
  splits.forEach((id, idx) => {
    shares.set(id, baseShare + (idx < remainder ? 1 : 0))
  })
  return shares
}

export function computeDongSettlement(event: DongEvent): DongCalculationSummary {
  const participants = event.participants
  if (participants.length === 0) return emptyDongSummary()

  const known = memberIds(event)
  const potActive = potAccountingActive(event)
  const madre = event.madreKharj
  const responsible = potActive
    ? participants.find((p) => p.id === madre?.responsibleId) ?? null
    : null

  const paidMap = new Map<string, number>()
  const shareMap = new Map<string, number>()
  const depositMap = new Map<string, number>()
  for (const p of participants) {
    paidMap.set(p.id, 0)
    shareMap.set(p.id, 0)
    depositMap.set(p.id, baseContribution(event, p.id, potActive) + extraDeposits(event, p.id, potActive, known))
  }

  let totalCost = 0
  let potSpent = 0
  for (const exp of event.expenses) {
    if (exp.amount <= 0) continue
    totalCost += exp.amount
    const paidFromPot = exp.paidById === MADRE_KHARJ_PAYER_ID
    if (paidFromPot) {
      potSpent += exp.amount
      if (!potActive) {
        paidMap.set(exp.paidById, (paidMap.get(exp.paidById) ?? 0) + exp.amount)
      }
    } else {
      paidMap.set(exp.paidById, (paidMap.get(exp.paidById) ?? 0) + exp.amount)
    }
    const splits =
      exp.splitAmongIds && exp.splitAmongIds.length > 0
        ? exp.splitAmongIds
        : participants.map((p) => p.id)
    for (const [id, share] of allocateShares(exp.amount, splits, exp)) {
      shareMap.set(id, (shareMap.get(id) ?? 0) + share)
    }
  }

  const totalDeposits = participants.reduce((sum, p) => sum + (depositMap.get(p.id) ?? 0), 0)
  const potBalance = potActive ? totalDeposits - potSpent : 0
  const deficitCovered = new Map<string, number>()
  if (potActive && potBalance < 0 && responsible) {
    deficitCovered.set(responsible.id, -potBalance)
  }

  const balances: DongParticipantBalance[] = participants.map((p) => {
    const paid = paidMap.get(p.id) ?? 0
    const deposits = depositMap.get(p.id) ?? 0
    const covered = deficitCovered.get(p.id) ?? 0
    const share = shareMap.get(p.id) ?? 0
    return {
      id: p.id,
      name: p.name,
      paid,
      deposits,
      deficitCovered: covered,
      share,
      net: paid + deposits + covered - share,
    }
  })

  const settledSet = new Set(event.settledTransfers || [])
  const individual = balances.map((b) => ({ id: b.id, name: b.name, net: b.net }))
  const debtors: Party[] = []
  const creditors: Party[] = []
  for (const row of individual) {
    if (row.net < -5) debtors.push({ id: row.id, name: row.name, remaining: -row.net })
    else if (row.net > 5) creditors.push({ id: row.id, name: row.name, remaining: row.net })
  }
  if (potActive) addPotParty(debtors, creditors, potBalance, Boolean(responsible))
  const transfers = settleParties(debtors, creditors, settledSet, (from, to) => `${from}_to_${to}`)

  const groupBalances: DongGroupBalance[] = []
  let ungroupedBalances: DongParticipantBalance[] = []
  let groupTransfers: SettlementTransfer[] = []

  if (event.groups && event.groups.length > 0) {
    const groupedMemberIdSet = new Set<string>()
    for (const g of event.groups) {
      const members = g.memberIds
        .map((mid) => balances.find((b) => b.id === mid))
        .filter((b): b is DongParticipantBalance => Boolean(b))
      members.forEach((m) => groupedMemberIdSet.add(m.id))
      groupBalances.push({
        id: g.id,
        name: g.name,
        memberIds: g.memberIds,
        paid: members.reduce((s, m) => s + m.paid, 0),
        deposits: members.reduce((s, m) => s + m.deposits, 0),
        deficitCovered: members.reduce((s, m) => s + m.deficitCovered, 0),
        share: members.reduce((s, m) => s + m.share, 0),
        net: members.reduce((s, m) => s + m.net, 0),
        memberBalances: members,
      })
    }
    ungroupedBalances = balances.filter((b) => !groupedMemberIdSet.has(b.id))

    const groupDebtors: Party[] = []
    const groupCreditors: Party[] = []
    for (const gb of groupBalances) {
      if (gb.net < -5) groupDebtors.push({ id: gb.id, name: `گروه ${gb.name}`, remaining: -gb.net })
      else if (gb.net > 5) groupCreditors.push({ id: gb.id, name: `گروه ${gb.name}`, remaining: gb.net })
    }
    for (const ub of ungroupedBalances) {
      if (ub.net < -5) groupDebtors.push({ id: ub.id, name: ub.name, remaining: -ub.net })
      else if (ub.net > 5) groupCreditors.push({ id: ub.id, name: ub.name, remaining: ub.net })
    }
    if (potActive) addPotParty(groupDebtors, groupCreditors, potBalance, Boolean(responsible))
    groupTransfers = settleParties(
      groupDebtors,
      groupCreditors,
      settledSet,
      (from, to) => `grp_${from}_to_${to}`,
    )
  }

  return {
    transfers,
    balances,
    groupBalances,
    ungroupedBalances,
    groupTransfers,
    totalCost,
    potActive,
    potBalance,
    totalDeposits,
    potSpent,
    responsibleId: responsible?.id ?? null,
    ledger: buildLedger(event, potActive, known),
  }
}

export function knownDeposits(event: DongEvent): DongPotDeposit[] {
  const known = memberIds(event)
  return (event.madreKharj?.deposits ?? []).filter((d) => known.has(d.memberId) && d.amount > 0)
}
