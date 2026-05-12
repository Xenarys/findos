'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/app/context/empresa'

interface OC {
  id: string
  numero: string
  fecha: string
  estado: string
  moneda: string
  total_neto: number
  total_impuestos: number
  total: number
  documento_abierto: boolean
  entidades?: { razon_social: string }
  condiciones_pago?: { nombre: string }
}

export default function ComprasPage() {
  const { empresaActual } = useEmpresa()
  const router = useRouter()
  const [ocs, setOcs] = useState<OC[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  useEffect(() => { if (empresaActual) cargarOCs() }, [empresaActual])

  async function cargarOCs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ordenes_compra')
      .select('*, entidades(razon_social), condiciones_pago(nombre)')
      .eq('empresa_id', empresaActual!.id)
      .order('numero', { ascending: false })
    if (!error && data) setOcs(data)
    setLoading(false)
  }

  async function nuevaOC() {
    router.push('/compras/nueva')
  }

  const estadoColor: any = {
    borrador: 'bg-gray-50 text-gray-600',
    emitida: 'bg-blue-50 text-blue-700',
    cerrada: 'bg-green-50 text-green-700',
    anulada: 'bg-red-50 text-red-700',
  }

  const ocsFiltradas = ocs.filter(oc => {
    const matchBusqueda = oc.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
      oc.entidades?.razon_social.toLowerCase().includes(busqueda.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || oc.estado === filtroEstado
    return matchBusqueda && matchEstado
  })

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(n)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Órdenes de Compra</h1>
            <p className="text-sm text-gray-500">{ocs.length} registros · {empresaActual?.nombre}</p>
          </div>
          <button onClick={nuevaOC} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            + Nueva OC
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por número o proveedor..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          {['todos', 'borrador', 'emitida', 'cerrada', 'anulada'].map(f => (
            <button key={f} onClick={() => setFiltroEstado(f)}
              className={`px-3 py-2 rounded-lg text-sm capitalize ${filtroEstado === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              {f === 'todos' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : ocsFiltradas.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No hay órdenes de compra aún</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Número', 'Proveedor', 'Fecha', 'Condición pago', 'Moneda', 'Neto', 'Total', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {ocsFiltradas.map(oc => (
                  <tr key={oc.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{oc.numero}</td>
                    <td className="px-4 py-3 font-medium">{oc.entidades?.razon_social || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{oc.fecha}</td>
                    <td className="px-4 py-3 text-gray-600">{oc.condiciones_pago?.nombre || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{oc.moneda}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(oc.total_neto)}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">{fmt(oc.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${estadoColor[oc.estado]}`}>
                        {oc.estado.charAt(0).toUpperCase() + oc.estado.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => router.push(`/compras/${oc.id}`)}
                        className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}