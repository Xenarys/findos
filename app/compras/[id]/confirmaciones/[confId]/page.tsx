'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ItemConfirmacion {
  id: string
  item_id: string
  numero_item: number
  referencia_itsm: string | null
  cantidad_confirmada: number
  subtotal_bruto_conf: number
  monto_descuentos_item: number
  monto_descuentos_global: number
  subtotal_neto_conf: number
  cuenta_item: string | null
  ordenes_compra_items?: {
    numero_item: number
    descripcion: string
    precio_unitario: number
    bienes_servicios?: {
      codigo: string
      unidad: string
    }
  }
}

interface Confirmacion {
  id: string
  numero_confirmacion: string
  fecha_confirmacion: string
  estado: string
  orden_compra_id: string
  ordenes_compra?: {
    numero: string
    entidades?: {
      razon_social: string
      rut: string
    }
  }
}

export default function DetalleConfirmacionPage() {
  const params = useParams()
  const id = String(params.id)
  const confId = String(params.confId)
  const router = useRouter()

  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)
  const [items, setItems] = useState<ItemConfirmacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarTodo() }, [confId])

  async function cargarTodo() {
    setLoading(true)

    const [confData, itemsData] = await Promise.all([
      supabase
        .from('oc_confirmaciones')
        .select('*, ordenes_compra(numero, entidades(razon_social, rut))')
        .eq('id', confId)
        .single(),
      supabase
        .from('oc_confirmaciones_items')
        .select('id, item_id, numero_item, referencia_itsm, cantidad_confirmada, subtotal_bruto_conf, monto_descuentos_item, monto_descuentos_global, subtotal_neto_conf, cuenta_item, ordenes_compra_items(numero_item, descripcion, precio_unitario, bienes_servicios(codigo, unidad))')
        .eq('confirmacion_id', confId)
        .order('numero_item')
    ])

    if (confData.data) setConfirmacion(confData.data as Confirmacion)
    if (itemsData.data) setItems(itemsData.data as any)

    setLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  const totalBruto = items.reduce((sum, i) => sum + i.subtotal_bruto_conf, 0)
  const totalDescuentosItem = items.reduce((sum, i) => sum + i.monto_descuentos_item, 0)
  const totalDescuentosGlobal = items.reduce((sum, i) => sum + i.monto_descuentos_global, 0)
  const totalNeto = items.reduce((sum, i) => sum + i.subtotal_neto_conf, 0)

  async function anularConfirmacion() {
  if (!window.confirm('¿Estás seguro de que deseas anular esta confirmación?')) return

  // Restar cantidades de vuelta en los ítems de la OC
  for (const item of items) {
    const { data: ocItem } = await supabase
      .from('ordenes_compra_items')
      .select('cantidad_confirmada')
      .eq('id', item.item_id)
      .single()

    if (ocItem) {
      const nuevaCantidad = Math.max(0, ocItem.cantidad_confirmada - item.cantidad_confirmada)
      await supabase
        .from('ordenes_compra_items')
        .update({ cantidad_confirmada: nuevaCantidad })
        .eq('id', item.item_id)
    }
  }

  // Anular la confirmación
  const { error } = await supabase
    .from('oc_confirmaciones')
    .update({ estado: 'anulada' })
    .eq('id', confirmacion?.id)

  if (error) {
    alert('Error: ' + error.message)
    return
  }

  alert('Confirmación anulada')
  router.push(`/compras/${id}/confirmaciones`)
}

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>
  if (!confirmacion) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Confirmación no encontrada</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/compras/${id}/confirmaciones`)} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
          <h1 className="text-2xl font-semibold text-gray-800">Confirmación de Compra</h1>
        </div>

        {/* CABECERA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Número confirmación</p>
              <p className="text-lg font-mono font-semibold text-blue-600">{confirmacion.numero_confirmacion}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Estado</p>
              <span className={`text-sm px-2 py-1 rounded font-medium inline-block ${
                confirmacion.estado === 'pending_factura' ? 'bg-yellow-50 text-yellow-700' :
                confirmacion.estado === 'facturada' ? 'bg-green-50 text-green-700' :
                'bg-red-50 text-red-700'
              }`}>
                {confirmacion.estado === 'pending_factura' ? 'Pendiente factura' :
                 confirmacion.estado === 'facturada' ? 'Facturada' : 'Anulada'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Orden de Compra</p>
              <p className="text-sm font-medium text-gray-800">{confirmacion.ordenes_compra?.numero}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Proveedor</p>
              <p className="text-sm text-gray-800">{confirmacion.ordenes_compra?.entidades?.razon_social}</p>
              <p className="text-xs text-gray-500">{confirmacion.ordenes_compra?.entidades?.rut}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fecha confirmación</p>
              <p className="text-sm text-gray-800">{new Date(confirmacion.fecha_confirmacion).toLocaleDateString('es-CL')}</p>
            </div>
          </div>
        </div>

        {/* ÍTEMS CONFIRMADOS */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Ítems confirmados</h2>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="border border-gray-100 rounded-lg p-4">
                
                {/* Encabezado ítem */}
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-1">
                    <label className="text-xs text-gray-400 block mb-1">Conf #</label>
                    <p className="text-xs font-semibold text-gray-700">{item.numero_item}</p>
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-gray-400 block mb-1">OC #</label>
                    <p className="text-xs font-semibold text-blue-600">{item.ordenes_compra_items?.numero_item}</p>
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-gray-400 block mb-1">Código</label>
                    <p className="text-xs font-mono text-gray-600">{item.ordenes_compra_items?.bienes_servicios?.codigo || '—'}</p>
                  </div>
                  <div className="col-span-4">
                    <label className="text-xs text-gray-400 block mb-1">Descripción</label>
                    <p className="text-xs text-gray-700">{item.ordenes_compra_items?.descripcion}</p>
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-gray-400 block mb-1">Unidad</label>
                    <p className="text-xs text-gray-600">{item.ordenes_compra_items?.bienes_servicios?.unidad || '—'}</p>
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-gray-400 block mb-1">Cantidad</label>
                    <p className="text-xs font-mono text-gray-700">{item.cantidad_confirmada}</p>
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-gray-400 block mb-1">Precio u.</label>
                    <p className="text-xs font-mono text-gray-700">{fmt(item.ordenes_compra_items?.precio_unitario || 0)}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 block mb-1">Subtotal neto</label>
                    <p className="text-xs font-mono font-medium text-gray-800">{fmt(item.subtotal_neto_conf)}</p>
                  </div>
                </div>

                {/* Referencia ITSM */}
                {item.referencia_itsm && (
                  <div className="mb-3 pb-3 border-b border-gray-100">
                    <label className="text-xs text-gray-400 block mb-1">Referencia ITSM</label>
                    <p className="text-xs font-mono text-blue-600 font-medium">{item.referencia_itsm}</p>
                  </div>
                )}

                {/* Desglose de montos */}
                <div className="bg-gray-50 rounded p-3 text-xs space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-gray-600">Subtotal bruto:</span>
                    <span className="text-right font-mono text-gray-700">{fmt(item.subtotal_bruto_conf)}</span>
                  </div>
                  {item.monto_descuentos_item > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-gray-600">− Descuentos ítem:</span>
                      <span className="text-right font-mono text-gray-700">{fmt(item.monto_descuentos_item)}</span>
                    </div>
                  )}
                  {item.monto_descuentos_global > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-gray-600">− Descuentos global:</span>
                      <span className="text-right font-mono text-gray-700">{fmt(item.monto_descuentos_global)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-1 grid grid-cols-2 gap-2 font-medium">
                    <span className="text-gray-700">= Subtotal neto:</span>
                    <span className="text-right font-mono text-gray-800">{fmt(item.subtotal_neto_conf)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TOTALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="flex justify-end">
            <div className="w-80 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal bruto ítems</span>
                <span className="font-mono">{fmt(totalBruto)}</span>
              </div>
              {totalDescuentosItem > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>− Descuentos de ítems</span>
                  <span className="font-mono">{fmt(totalDescuentosItem)}</span>
                </div>
              )}
              {totalDescuentosGlobal > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>− Descuentos globales</span>
                  <span className="font-mono">{fmt(totalDescuentosGlobal)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-800 text-base">
                <span>Total neto (sin impuestos)</span>
                <span className="font-mono">{fmt(totalNeto)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* NOTA */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
          <p className="text-xs text-blue-700">
            <span className="font-medium">Nota:</span> Los impuestos se agregarán cuando se registre la factura contra esta confirmación.
          </p>
        </div>

        {/* ACCIONES */}
        <div className="flex justify-end gap-3">
          <button onClick={() => router.push(`/compras/${id}/confirmaciones`)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            Volver
          </button>
          {confirmacion.estado === 'pending_factura' && (
            <>
              <button onClick={anularConfirmacion} className="px-6 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                Anular
              </button>
              <button disabled className="px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                Facturar (próximo módulo)
              </button>
            </>
          )}
          {confirmacion.estado === 'anulada' && (
            <span className="px-4 py-2 text-sm text-gray-500">Confirmación anulada</span>
          )}
        </div>

      </div>
    </div>
  )
}