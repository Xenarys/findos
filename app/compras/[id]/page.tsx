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

interface OcImpuesto {
  id: string
  item_id: string | null
  nivel: string
  porcentaje: number
  monto_calculado: number
  es_automatico: boolean
  impuestos?: { codigo: string; nombre: string }
}

interface OcCondicion {
  id: string
  item_id: string | null
  nivel: string
  valor: number
  monto_calculado: number
  condiciones_precio?: { nombre: string; abreviatura: string; tipo: string; forma_calculo: string }
}

export default function DetalleOCPage() {
  const { id } = useParams()
  const router = useRouter()
  const [oc, setOc] = useState<OC | null>(null)
  const [items, setItems] = useState<ItemOC[]>([])
  const [ocImpuestos, setOcImpuestos] = useState<OcImpuesto[]>([])
  const [ocCondiciones, setOcCondiciones] = useState<OcCondicion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarOC() }, [id])

  async function cargarOC() {
    setLoading(true)
    const [ocData, itemsData, impsData, condsData] = await Promise.all([
      supabase.from('ordenes_compra').select('*, entidades(razon_social, rut), condiciones_pago(nombre)').eq('id', id).single(),
      supabase.from('ordenes_compra_items').select('*, bienes_servicios(codigo, unidad)').eq('orden_compra_id', id).order('created_at'),
      supabase.from('oc_impuestos').select('*, impuestos(codigo, nombre)').eq('orden_compra_id', id),
      supabase.from('oc_condiciones').select('*, condiciones_precio(nombre, abreviatura, tipo, forma_calculo)').eq('orden_compra_id', id),
    ])
    if (ocData.data) setOc(ocData.data)
    if (itemsData.data) setItems(itemsData.data)
    if (impsData.data) setOcImpuestos(impsData.data)
    if (condsData.data) setOcCondiciones(condsData.data)
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

  // Helpers para filtrar por item
  const impsItem = (itemId: string) => ocImpuestos.filter(i => i.item_id === itemId)
  const condsItem = (itemId: string) => ocCondiciones.filter(c => c.item_id === itemId)
  const impsCabecera = ocImpuestos.filter(i => !i.item_id)
  const condsCabecera = ocCondiciones.filter(c => !c.item_id)

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
              <>
                <button onClick={() => router.push(`/compras/${id}/confirmar`)}
                  className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                  Confirmar recepción
                </button>
                <button onClick={() => cambiarEstado('cerrada')}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Cerrar OC
                </button>
              </>
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
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="border border-gray-100 rounded-lg p-4">
                {/* Fila principal */}
                <div className="grid grid-cols-8 gap-2 text-sm mb-2">
                  <div className="col-span-1">
                    <p className="text-xs text-gray-400 mb-1">Código</p>
                    <p className="font-mono text-xs text-gray-500">{item.bienes_servicios?.codigo || '—'}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-xs text-gray-400 mb-1">Descripción</p>
                    <p className="font-medium text-sm">{item.descripcion}</p>
                  </div>
                  <div className="col-span-1 text-center">
                    <p className="text-xs text-gray-400 mb-1">Unidad</p>
                    <p className="text-xs text-gray-600">{item.bienes_servicios?.unidad || '—'}</p>
                  </div>
                  <div className="col-span-1 text-right">
                    <p className="text-xs text-gray-400 mb-1">Cantidad</p>
                    <p className="font-mono text-xs">{item.cantidad}</p>
                  </div>
                  <div className="col-span-1 text-right">
                    <p className="text-xs text-gray-400 mb-1">Precio unit.</p>
                    <p className="font-mono text-xs">{fmt(item.precio_unitario)}</p>
                  </div>
                  <div className="col-span-1 text-right">
                    <p className="text-xs text-gray-400 mb-1">Subtotal</p>
                    <p className="font-mono text-sm font-medium">{fmt(item.cantidad * item.precio_unitario)}</p>
                  </div>
                </div>

                {/* Condiciones del ítem */}
                {condsItem(item.id).length > 0 && (
                  <div className="mt-2 pl-2 border-l-2 border-amber-100">
                    {condsItem(item.id).map(c => (
                      <div key={c.id} className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${c.condiciones_precio?.tipo === 'descuento' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {c.condiciones_precio?.tipo === 'descuento' ? '-' : '+'} {c.condiciones_precio?.abreviatura}
                        </span>
                        <span className="text-xs text-gray-500">{c.condiciones_precio?.nombre}</span>
                        <span className="text-xs text-gray-400">
                          {c.valor}{c.condiciones_precio?.forma_calculo === 'porcentual' ? '%' : '$'}
                        </span>
                        <span className="text-xs font-mono text-gray-600 ml-auto">{fmt(c.monto_calculado)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Impuestos del ítem */}
                {impsItem(item.id).length > 0 && (
                  <div className="mt-2 pl-2 border-l-2 border-blue-100">
                    {impsItem(item.id).map(imp => (
                      <div key={imp.id} className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{imp.impuestos?.codigo}</span>
                        <span className="text-xs text-gray-500">{imp.impuestos?.nombre}</span>
                        <span className="text-xs text-gray-400">{imp.porcentaje}%</span>
                        {imp.es_automatico && <span className="text-xs text-gray-400">(auto)</span>}
                        <span className="text-xs font-mono text-gray-600 ml-auto">{fmt(imp.monto_calculado)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Estado confirmación */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Confirmado: {item.cantidad_confirmada} / {item.cantidad}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.documento_abierto ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                    {item.documento_abierto ? 'Abierto' : 'Cerrado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CONDICIONES CABECERA */}
        {condsCabecera.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Condiciones de precio globales</h2>
            {condsCabecera.map(c => (
              <div key={c.id} className="flex items-center gap-3 mb-2 text-sm">
                <span className={`text-xs px-2 py-0.5 rounded ${c.condiciones_precio?.tipo === 'descuento' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {c.condiciones_precio?.tipo === 'descuento' ? '-' : '+'} {c.condiciones_precio?.abreviatura}
                </span>
                <span className="text-gray-600">{c.condiciones_precio?.nombre}</span>
                <span className="text-gray-400 text-xs">
                  {c.valor}{c.condiciones_precio?.forma_calculo === 'porcentual' ? '%' : '$'}
                </span>
                <span className="font-mono text-gray-700 ml-auto">{fmt(Math.abs(c.monto_calculado))}</span>
              </div>
            ))}
          </div>
        )}

        {/* IMPUESTOS CABECERA */}
        {impsCabecera.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Impuestos globales</h2>
            {impsCabecera.map(i => (
              <div key={i.id} className="flex items-center gap-3 mb-2 text-sm">
                <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">{i.impuestos?.codigo}</span>
                <span className="text-gray-600">{i.impuestos?.nombre} · {i.porcentaje}%</span>
                <span className="font-mono text-gray-700 ml-auto">{fmt(i.monto_calculado)}</span>
              </div>
            ))}
          </div>
        )}

        {/* TOTALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total neto ítems</span>
                <span className="font-mono">{fmt(oc.total_neto)}</span>
              </div>
              {condsCabecera.map(c => (
                <div key={c.id} className="flex justify-between text-gray-500">
                  <span>{c.condiciones_precio?.tipo === 'descuento' ? '-' : '+'} {c.condiciones_precio?.nombre}</span>
                  <span className="font-mono">{fmt(Math.abs(c.monto_calculado))}</span>
                </div>
              ))}
              <div className="flex justify-between text-gray-500">
                <span>Impuestos</span>
                <span className="font-mono">{fmt(oc.total_impuestos)}</span>
              </div>
              {impsCabecera.map(i => (
                <div key={i.id} className="flex justify-between text-gray-500">
                  <span>+ {i.impuestos?.nombre}</span>
                  <span className="font-mono">{fmt(i.monto_calculado)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-100 pt-2 text-base">
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