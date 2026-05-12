'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface OC {
  id: string
  numero: string
  fecha: string
  estado: string
  moneda: string
  observaciones: string | null
  total_neto: number
  total_impuestos: number
  total: number
  documento_abierto: boolean
  entidades?: { razon_social: string; rut: string }
  condiciones_pago?: { nombre: string }
}

interface ItemOC {
  id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  cantidad_confirmada: number
  documento_abierto: boolean
  bienes_servicios?: { codigo: string; unidad: string }
}

export default function DetalleOCPage() {
  const { id } = useParams()
  const router = useRouter()
  const [oc, setOc] = useState<OC | null>(null)
  const [items, setItems] = useState<ItemOC[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarOC() }, [id])

  async function cargarOC() {
    setLoading(true)
    const [ocData, itemsData] = await Promise.all([
      supabase.from('ordenes_compra').select('*, entidades(razon_social, rut), condiciones_pago(nombre)').eq('id', id).single(),
      supabase.from('ordenes_compra_items').select('*, bienes_servicios(codigo, unidad)').eq('orden_compra_id', id).order('created_at'),
    ])
    if (ocData.data) setOc(ocData.data)
    if (itemsData.data) setItems(itemsData.data)
    setLoading(false)
  }

  async function cambiarEstado(nuevoEstado: string) {
    if (!confirm(`¿Cambiar estado a "${nuevoEstado}"?`)) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('ordenes_compra').update({
      estado: nuevoEstado,
      updated_by: user?.email,
      updated_at: new Date().toISOString()
    }).eq('id', id)
    cargarOC()
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  const estadoColor: any = {
    borrador: 'bg-gray-50 text-gray-600',
    emitida: 'bg-blue-50 text-blue-700',
    cerrada: 'bg-green-50 text-green-700',
    anulada: 'bg-red-50 text-red-700',
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>
  if (!oc) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">OC no encontrada</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/compras')} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
            <h1 className="text-2xl font-semibold text-gray-800">{oc.numero}</h1>
            <span className={`text-xs px-2 py-1 rounded-full ${estadoColor[oc.estado]}`}>
              {oc.estado.charAt(0).toUpperCase() + oc.estado.slice(1)}
            </span>
          </div>
          <div className="flex gap-2">
            {oc.estado === 'borrador' && (
              <>
                <button onClick={() => router.push(`/compras/${id}/editar`)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  Editar
                </button>
                <button onClick={() => cambiarEstado('emitida')}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Emitir OC
                </button>
                <button onClick={() => cambiarEstado('anulada')}
                  className="px-3 py-1.5 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                  Anular
                </button>
              </>
            )}
            {oc.estado === 'emitida' && (
              <button onClick={() => cambiarEstado('cerrada')}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                Cerrar OC
              </button>
            )}
          </div>
        </div>

        {/* CABECERA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">Proveedor</p>
              <p className="font-medium">{oc.entidades?.razon_social}</p>
              <p className="text-xs text-gray-400 font-mono">{oc.entidades?.rut}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Fecha</p>
              <p className="font-medium">{oc.fecha}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Condición de pago</p>
              <p className="font-medium">{oc.condiciones_pago?.nombre || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Moneda</p>
              <p className="font-medium">{oc.moneda}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-400 mb-1">Observaciones</p>
              <p className="font-medium">{oc.observaciones || '—'}</p>
            </div>
          </div>
        </div>

        {/* ITEMS */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Ítems</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Código', 'Descripción', 'Unidad', 'Cantidad', 'Precio unit.', 'Subtotal', 'Confirmado', 'Estado'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-400">{item.bienes_servicios?.codigo}</td>
                  <td className="px-3 py-2 font-medium">{item.descripcion}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{item.bienes_servicios?.unidad || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{item.cantidad}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{fmt(item.precio_unitario)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-medium">{fmt(item.subtotal)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">{item.cantidad_confirmada}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.documento_abierto ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                      {item.documento_abierto ? 'Abierto' : 'Cerrado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TOTALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total neto</span>
                <span className="font-mono">{fmt(oc.total_neto)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Impuestos</span>
                <span className="font-mono">{fmt(oc.total_impuestos)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-gray-800 border-t border-gray-100 pt-2">
                <span>Total</span>
                <span className="font-mono">{fmt(oc.total)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}