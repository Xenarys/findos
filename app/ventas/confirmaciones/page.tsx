'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Confirmacion {
  id: string
  numero_confirmacion: string
  fecha_confirmacion: string
  estado: string
  hes: string
  pedido_venta_id: string
  pedidos_venta?: {
    numero: string
    entidades?: {
      razon_social: string
    }
  }
  total_neto: number
}

export default function ConfirmacionesPVGlobalPage() {
  const router = useRouter()
  const [confirmaciones, setConfirmaciones] = useState<Confirmacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)

    const { data } = await supabase
      .from('pv_confirmaciones')
      .select('*, pedidos_venta(numero, entidades(razon_social))')
      .order('fecha_confirmacion', { ascending: false })

    if (data) {
      const confsConTotales = await Promise.all(data.map(async (conf: any) => {
        const { data: items } = await supabase
          .from('pv_confirmaciones_items')
          .select('subtotal_neto_conf')
          .eq('confirmacion_id', conf.id)
        const total = items?.reduce((sum, i) => sum + i.subtotal_neto_conf, 0) || 0
        return { ...conf, total_neto: total }
      }))
      setConfirmaciones(confsConTotales)
    }

    setLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  const confirmacionesFiltradas = confirmaciones.filter(c => {
    const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado
    const matchBusqueda = busqueda === '' ||
      c.numero_confirmacion.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.pedidos_venta?.numero || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.pedidos_venta?.entidades?.razon_social || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      c.hes.toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchBusqueda
  })

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Confirmaciones de Venta</h1>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar PV, confirmación, cliente o HES..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
            <div className="flex gap-2">
              {['todos', 'pending_factura', 'facturada', 'anulada'].map(estado => (
                <button key={estado} onClick={() => setFiltroEstado(estado)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    filtroEstado === estado
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {estado === 'todos' ? 'Todas' :
                   estado === 'pending_factura' ? 'Pendiente factura' :
                   estado === 'facturada' ? 'Facturadas' : 'Anuladas'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LISTA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          {confirmacionesFiltradas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin confirmaciones</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 text-gray-600 font-medium">Confirmación</th>
                    <th className="text-left py-3 text-gray-600 font-medium">PV</th>
                    <th className="text-left py-3 text-gray-600 font-medium">Cliente</th>
                    <th className="text-left py-3 text-gray-600 font-medium">HES</th>
                    <th className="text-left py-3 text-gray-600 font-medium">Fecha</th>
                    <th className="text-right py-3 text-gray-600 font-medium">Total neto</th>
                    <th className="text-center py-3 text-gray-600 font-medium">Estado</th>
                    <th className="text-center py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {confirmacionesFiltradas.map(conf => (
                    <tr key={conf.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="py-3 font-mono text-blue-600 font-medium">{conf.numero_confirmacion}</td>
                      <td className="py-3 font-mono text-gray-700">{conf.pedidos_venta?.numero}</td>
                      <td className="py-3 text-gray-700">{conf.pedidos_venta?.entidades?.razon_social}</td>
                      <td className="py-3 font-mono text-gray-700">{conf.hes}</td>
                      <td className="py-3 text-gray-700">{new Date(conf.fecha_confirmacion).toLocaleDateString('es-CL')}</td>
                      <td className="py-3 text-right font-mono text-gray-800">{fmt(conf.total_neto)}</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          conf.estado === 'pending_factura' ? 'bg-yellow-50 text-yellow-700' :
                          conf.estado === 'facturada' ? 'bg-green-50 text-green-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {conf.estado === 'pending_factura' ? 'Pendiente factura' :
                           conf.estado === 'facturada' ? 'Facturada' : 'Anulada'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => router.push(`/ventas/${conf.pedido_venta_id}/confirmaciones/${conf.id}`)}
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