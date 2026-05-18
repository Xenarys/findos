'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Confirmacion {
  id: string
  numero_confirmacion: string
  fecha_confirmacion: string
  estado: string
  hes: string
  total_neto: number
}

export default function ConfirmacionesPVListPage() {
  const { id } = useParams()
  const router = useRouter()

  const [pv, setPv] = useState<any>(null)
  const [confirmaciones, setConfirmaciones] = useState<Confirmacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarTodo() }, [id])

  async function cargarTodo() {
    setLoading(true)

    const [pvData, confsData] = await Promise.all([
      supabase.from('pedidos_venta').select('numero').eq('id', id).single(),
      supabase.from('pv_confirmaciones').select('*').eq('pedido_venta_id', id).order('fecha_confirmacion', { ascending: false })
    ])

    if (pvData.data) setPv(pvData.data)

    if (confsData.data) {
      const confsConTotales = await Promise.all(confsData.data.map(async (conf: any) => {
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

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/ventas/${id}`)} className="text-gray-400 hover:text-gray-600 text-sm">← Volver a PV</button>
          <h1 className="text-2xl font-semibold text-gray-800">Confirmaciones</h1>
          <span className="text-gray-500 text-sm">({pv?.numero})</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          {confirmaciones.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">Sin confirmaciones</p>
              <button onClick={() => router.push(`/ventas/${id}/confirmar`)} className="text-blue-600 hover:text-blue-800 text-sm mt-2">
                Crear confirmación →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 text-gray-600 font-medium">Confirmación</th>
                    <th className="text-left py-3 text-gray-600 font-medium">HES</th>
                    <th className="text-left py-3 text-gray-600 font-medium">Fecha</th>
                    <th className="text-right py-3 text-gray-600 font-medium">Total neto</th>
                    <th className="text-center py-3 text-gray-600 font-medium">Estado</th>
                    <th className="text-center py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {confirmaciones.map(conf => (
                    <tr key={conf.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="py-3 font-mono text-blue-600 font-medium">{conf.numero_confirmacion}</td>
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
                        <button onClick={() => router.push(`/ventas/${id}/confirmaciones/${conf.id}`)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                          Ver detalle →
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