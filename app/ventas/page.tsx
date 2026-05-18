'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface PedidoVenta {
  id: string
  numero: string
  fecha: string
  estado: string
  moneda: string
  total: number
  entidades?: { razon_social: string }
}

export default function VentasPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<PedidoVenta[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos_venta')
      .select('*, entidades(razon_social)')
      .order('numero', { ascending: false })
    if (data) setPedidos(data)
    setLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  const pedidosFiltrados = pedidos.filter(p => {
    const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado
    const matchBusqueda = busqueda === '' ||
      p.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.entidades?.razon_social || '').toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchBusqueda
  })

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Pedidos de Venta</h1>
          <button onClick={() => router.push('/ventas/nueva')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            + Nuevo PV
          </button>
        </div>

        {/* FILTROS */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Buscar PV o cliente..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <div className="flex gap-2">
            {['todos', 'borrador', 'emitida', 'anulada'].map(estado => (
              <button key={estado} onClick={() => setFiltroEstado(estado)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filtroEstado === estado
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}>
                {estado === 'todos' ? 'Todos' :
                 estado === 'borrador' ? 'Borrador' :
                 estado === 'emitida' ? 'Emitida' : 'Anulada'}
              </button>
            ))}
          </div>
        </div>

        {/* LISTA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          {pedidosFiltrados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin pedidos de venta</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 text-gray-600 font-medium">Número</th>
                    <th className="text-left py-3 text-gray-600 font-medium">Cliente</th>
                    <th className="text-left py-3 text-gray-600 font-medium">Fecha</th>
                    <th className="text-center py-3 text-gray-600 font-medium">Moneda</th>
                    <th className="text-right py-3 text-gray-600 font-medium">Total</th>
                    <th className="text-center py-3 text-gray-600 font-medium">Estado</th>
                    <th className="text-center py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosFiltrados.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => router.push(`/ventas/${p.id}`)}>
                      <td className="py-3 font-mono text-blue-600 font-medium">{p.numero}</td>
                      <td className="py-3 text-gray-700">{p.entidades?.razon_social}</td>
                      <td className="py-3 text-gray-700">{new Date(p.fecha).toLocaleDateString('es-CL')}</td>
                      <td className="py-3 text-center text-gray-600">{p.moneda}</td>
                      <td className="py-3 text-right font-mono text-gray-800">{fmt(p.total)}</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          p.estado === 'borrador' ? 'bg-gray-100 text-gray-700' :
                          p.estado === 'emitida' ? 'bg-blue-50 text-blue-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {p.estado === 'borrador' ? 'Borrador' :
                           p.estado === 'emitida' ? 'Emitida' : 'Anulada'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <button onClick={e => { e.stopPropagation(); router.push(`/ventas/${p.id}`) }}
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