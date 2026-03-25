"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import type { Balancete } from "@/repositories/balancetesRepo.supabase"
import type { Condominium } from "@/repositories/condominiumsRepo.supabase"
import {
  getBalanceteStatus,
  getBalanceteStatusLabel,
  getMonthsAgoLabel,
  parseCompetencia,
  type BalanceteStatusColor,
} from "@/lib/balanceteStatus"

interface BalancetesDashboardProps {
  balancetes: Balancete[]
  condominiums: Condominium[]
}

type SortField = 'condominium' | 'competencia' | 'defasagem' | 'status'
type SortDirection = 'asc' | 'desc'

const statusOrder: Record<BalanceteStatusColor, number> = {
  green: 0,
  yellow: 1,
  red: 2,
  none: 3,
}

const statusColorClasses: Record<BalanceteStatusColor, string> = {
  green: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100",
  red: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
  none: "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100",
}

const statusDotClasses: Record<BalanceteStatusColor, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  none: "bg-gray-300",
}

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField | null; sortDirection: SortDirection }) {
  if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />
  if (sortDirection === 'asc') return <ArrowUp className="w-3.5 h-3.5 ml-1 text-primary" />
  return <ArrowDown className="w-3.5 h-3.5 ml-1 text-primary" />
}

export function BalancetesDashboard({ balancetes, condominiums }: BalancetesDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | BalanceteStatusColor>('all')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const rows = useMemo(() => {
    const activeCondominiums = condominiums.filter((c) => c.active === true)

    return activeCondominiums.map((cond) => {
      const condBalancetes = balancetes.filter((b) => b.condominium_id === cond.id)

      let latestCompetencia: string | null = null
      if (condBalancetes.length > 0) {
        latestCompetencia = condBalancetes.reduce((best, b) => {
          if (!best) return b.competencia
          const bestDate = parseCompetencia(best)
          const bDate = parseCompetencia(b.competencia)
          return bDate > bestDate ? b.competencia : best
        }, null as string | null)
      }

      const status = getBalanceteStatus(latestCompetencia)
      const defasagemLabel = getMonthsAgoLabel(latestCompetencia)
      const statusLabel = getBalanceteStatusLabel(status)

      const monthsAgo = latestCompetencia
        ? Math.round(
            (new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() -
              parseCompetencia(latestCompetencia).getTime()) /
              (1000 * 60 * 60 * 24 * 30.44)
          )
        : 999

      return {
        id: cond.id,
        condominium: cond.name,
        competencia: latestCompetencia,
        defasagemLabel,
        statusLabel,
        status,
        monthsAgo,
      }
    })
  }, [balancetes, condominiums])

  const counts = useMemo(() => {
    return {
      all: rows.length,
      green: rows.filter((r) => r.status === 'green').length,
      yellow: rows.filter((r) => r.status === 'yellow').length,
      red: rows.filter((r) => r.status === 'red').length,
      none: rows.filter((r) => r.status === 'none').length,
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((r) => r.status === statusFilter)
  }, [rows, statusFilter])

  const sortedRows = useMemo(() => {
    if (!sortField) return filteredRows

    return [...filteredRows].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1

      if (sortField === 'condominium') {
        return a.condominium.localeCompare(b.condominium) * dir
      }
      if (sortField === 'competencia') {
        if (!a.competencia && !b.competencia) return 0
        if (!a.competencia) return 1 * dir
        if (!b.competencia) return -1 * dir
        const aDate = parseCompetencia(a.competencia)
        const bDate = parseCompetencia(b.competencia)
        return (aDate.getTime() - bDate.getTime()) * dir
      }
      if (sortField === 'defasagem') {
        return (a.monthsAgo - b.monthsAgo) * dir
      }
      if (sortField === 'status') {
        const diff = statusOrder[a.status] - statusOrder[b.status]
        if (diff !== 0) return diff * dir
        return a.condominium.localeCompare(b.condominium)
      }
      return 0
    })
  }, [filteredRows, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortField(null)
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleFilterClick = (filter: 'all' | BalanceteStatusColor) => {
    setStatusFilter((prev) => (prev === filter ? 'all' : filter))
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => handleFilterClick('all')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            statusFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-white text-muted-foreground border-gray-200 hover:border-gray-300'
          }`}
        >
          Todos
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {counts.all}
          </span>
        </button>

        <button
          onClick={() => handleFilterClick('green')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            statusFilter === 'green'
              ? 'bg-green-600 text-white border-green-600 shadow-sm'
              : 'bg-white text-green-700 border-green-200 hover:border-green-400'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-green-500" />
          Em dia
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === 'green' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
            {counts.green}
          </span>
        </button>

        <button
          onClick={() => handleFilterClick('yellow')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            statusFilter === 'yellow'
              ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm'
              : 'bg-white text-yellow-700 border-yellow-200 hover:border-yellow-400'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          Atenção
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === 'yellow' ? 'bg-white/20 text-white' : 'bg-yellow-100 text-yellow-700'}`}>
            {counts.yellow}
          </span>
        </button>

        <button
          onClick={() => handleFilterClick('red')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            statusFilter === 'red'
              ? 'bg-red-600 text-white border-red-600 shadow-sm'
              : 'bg-white text-red-700 border-red-200 hover:border-red-400'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          Atrasado
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === 'red' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
            {counts.red}
          </span>
        </button>

        <button
          onClick={() => handleFilterClick('none')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            statusFilter === 'none'
              ? 'bg-gray-500 text-white border-gray-500 shadow-sm'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          Sem balancete
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === 'none' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {counts.none}
          </span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {sortedRows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum condomínio encontrado para este filtro.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('condominium')}
                >
                  <div className="flex items-center">
                    Condomínio
                    <SortIcon field="condominium" sortField={sortField} sortDirection={sortDirection} />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors w-[160px]"
                  onClick={() => handleSort('competencia')}
                >
                  <div className="flex items-center">
                    Última Competência
                    <SortIcon field="competencia" sortField={sortField} sortDirection={sortDirection} />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors w-[180px]"
                  onClick={() => handleSort('defasagem')}
                >
                  <div className="flex items-center">
                    Defasagem
                    <SortIcon field="defasagem" sortField={sortField} sortDirection={sortDirection} />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors w-[140px]"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/10">
                  <TableCell className="font-medium py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${statusDotClasses[row.status]}`} />
                      {row.condominium}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    {row.competencia ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {row.defasagemLabel}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge className={`text-xs ${statusColorClasses[row.status]}`}>
                      {row.statusLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
