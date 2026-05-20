'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Factura {
  id: string
  numero_folio: string
  tipo: string
  flujo: string
  fecha: string
  moneda: string
  estado: string
  total: number
  entidades?: { razon_social: string }
}

export default function FacturasPage() {
  const router = useRouter()
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const { data } = await supabase
      .from('facturas')
      .select('*, entidades(razon_social)')
      .order('created_at', { ascending: false })
    if (data) setFacturas(data)
    setLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  const facturasFiltradas = facturas.filter(f => {
    const matchEstado = filtroEstado === 'todos' || f.estado === filtroEstado
    const matchTipo = filtroTipo === 'todos' || f.tipo === filtroTipo
    const matchBusqueda = busqueda === '' ||
      f.numero_folio.toLowerCase().includes(busqueda.toLowerCase()) ||
      (f.entidades?.razon_social || '').toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchTipo && matchBusqueda
  })

  const tipoLabel: Record<string, string> = {
    C1G: 'Compra OC', C2G: 'Compra Directa',
    V1G: 'Venta PV', V2G: 'Venta Directa',
    ND: 'Nota Débito', NC: 'Nota Crédito'
  }

  const tipoColor: Record<string, string> = {
    C1G: 'bg-blue-50 text-blue-700', C2G: 'bg-blue-50 text-blue-700',
    V1G: 'bg-green-50 text-green-700', V2G: 'bg-green-50 text-green-700',
    ND: 'bg-orange-50 text-orange-700', NC: 'bg-purple-50 text-purple-700'
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Facturas</h1>
          <div className="flex gap-2">
            <div className="relative">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2">
                + Nueva
                <span className="text-xs">▼</span>
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-50 hidden group-hover:block">
                {[
                  { label: 'Factura Compra OC (C1G)', href: '/facturas/nueva/c1g' },
                  { label: 'Factura Compra Directa (C2G)', href: '/facturas/nueva/c2g' },
                  { label: 'Factura Venta PV (V1G)', href: '/facturas/nueva/v1g' },
                  { label: 'Factura Venta Directa (V2G)', href: '/facturas/nueva/v2g' },
                  { label: 'Nota de Débito (ND)', href: '/facturas/nueva/nd' },
                  { label: 'Nota de Crédito (NC)', href: '/facturas/nueva/nc' },
                ].map(item => (
                  <button key={item.href} onClick={() => router.push(item.href)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ACCESOS DIRECTOS */}
        <div className="grid grid-cols-6 gap-2 mb-6">
          {[
            { tipo: 'c1g', label: 'Factura\nCompra OC', color: 'bg-blue-600' },
            { tipo: 'c2g', label: 'Factura\nCompra Directa', color: 'bg-blue-500' },
            { tipo: 'v1g', label: 'Factura\nVenta PV', color: 'bg-green-600' },
            { tipo: 'v2g', label: 'Factura\nVenta Directa', color: 'bg-green-500' },
            { tipo: 'nd', label: 'Nota de\nDébito', color: 'bg-orange-500' },
            { tipo: 'nc', label: 'Nota de\nCrédito', color: 'bg-purple-500' },
          ].map(item => (
            <button key={item.tipo}
              onClick={() => router.push(`/facturas/nueva/${item.tipo}`)}
              className={`${item.color} text-white rounded-xl p-3 text-xs font-medium text-center hover:opacity-90 whitespace-pre-line`}>
              {item.label}
            </button>
          ))}
        </div>

        {/* FILTROS */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Buscar folio o entidad..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <div className="flex gap-2">
            {['todos', 'borrador', 'emitida', 'anulada'].map(estado => (
              <button key={estado} onClick={() => setFiltroEstado(estado)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filtroEstado === estado
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}>
                {estado === 'todos' ? 'Todas' :
                 estado === 'borrador' ? 'Borrador' :
                 estado === 'emitida' ? 'Emitidas' : 'Anuladas'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {['todos', 'C1G', 'C2G', 'V1G', 'V2G', 'ND', 'NC'].map(tipo => (
              <button key={tipo} onClick={() => setFiltroTipo(tipo)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filtroTipo === tipo
                    ? 'bg-gray-700 text-white border-gray-700'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}>
                {tipo === 'todos' ? 'Todos' : tipo}
              </button>
            ))}
          </div>
        </div>

        {/* LISTA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          {facturasFiltradas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin facturas</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 text-gray-600 font-medium">Folio</th>
                    <th className="text-left py-3 text-gray-600 font-medium">Tipo</th>
                    <th className="text-left py-3 text-gray-600 font-medium">Entidad</th>
                    <th className="text-left py-3 text-gray-600 font-medium">Fecha</th>
                    <th className="text-center py-3 text-gray-600 font-medium">Moneda</th>
                    <th className="text-right py-3 text-gray-600 font-medium">Total</th>
                    <th className="text-center py-3 text-gray-600 font-medium">Estado</th>
                    <th className="text-center py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {facturasFiltradas.map(f => (
                    <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => router.push(`/facturas/${f.id}`)}>
                      <td className="py-3 font-mono text-blue-600 font-medium">{f.numero_folio || '—'}</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${tipoColor[f.tipo] || 'bg-gray-100 text-gray-700'}`}>
                          {tipoLabel[f.tipo] || f.tipo}
                        </span>
                      </td>
                      <td className="py-3 text-gray-700">{f.entidades?.razon_social}</td>
                      <td className="py-3 text-gray-700">{new Date(f.fecha).toLocaleDateString('es-CL')}</td>
                      <td className="py-3 text-center text-gray-600">{f.moneda}</td>
                      <td className="py-3 text-right font-mono text-gray-800">{fmt(f.total)}</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          f.estado === 'borrador' ? 'bg-gray-100 text-gray-700' :
                          f.estado === 'emitida' ? 'bg-green-50 text-green-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {f.estado === 'borrador' ? 'Borrador' :
                           f.estado === 'emitida' ? 'Emitida' : 'Anulada'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <button onClick={e => { e.stopPropagation(); router.push(`/facturas/${f.id}`) }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                          Ver →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}