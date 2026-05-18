'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ItemOC {
  id: string
  bien_servicio_id: string
  descripcion: string
  cantidad: number
  cantidad_confirmada: number
  precio_unitario: number
  subtotal: number
  numero_item: number
  cuenta_id: string | null
  bienes_servicios?: { codigo: string; unidad: string }
}

interface Confirmacion {
  id: string
  numero_confirmacion: string
  fecha_confirmacion: string
  estado: string
  total_neto: number
}

export default function DetalleOCPage() {
  const { id } = useParams()
  const router = useRouter()

  const [oc, setOc] = useState<any>(null)
  const [items, setItems] = useState<ItemOC[]>([])
  const [confirmaciones, setConfirmaciones] = useState<Confirmacion[]>([])
  const [condiciones, setCondiciones] = useState<any[]>([])
  const [impuestos, setImpuestos] = useState<any[]>([])
  const [montosConfirmadosSG, setMontosConfirmadosSG] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [emitiendo, setEmitiendo] = useState(false)
  const [anulando, setAnulando] = useState(false)

  useEffect(() => { cargarTodo() }, [id])

  async function cargarTodo() {
    setLoading(true)

    const [ocData, itemsData, condsData, impsData, confsData] = await Promise.all([
      supabase.from('ordenes_compra').select('*, entidades(razon_social, rut)').eq('id', id).single(),
      supabase.from('ordenes_compra_items').select('*, bienes_servicios(codigo, unidad)').eq('orden_compra_id', id).order('numero_item'),
      supabase.from('oc_condiciones').select('*, condiciones_precio(nombre, abreviatura, tipo)').eq('orden_compra_id', id),
      supabase.from('oc_impuestos').select('*, impuestos(codigo, nombre, tipo, porcentaje)').eq('orden_compra_id', id),
      supabase.from('oc_confirmaciones').select('*').eq('orden_compra_id', id).order('fecha_confirmacion', { ascending: false })
    ])

    if (ocData.data) setOc(ocData.data)
    if (condsData.data) setCondiciones(condsData.data)
    if (impsData.data) setImpuestos(impsData.data)

    if (itemsData.data) {
      setItems(itemsData.data)
      const itemsSG = itemsData.data.filter((i: any) => i.bienes_servicios?.unidad === 'Servicio Global')
      const montos: Record<string, number> = {}
      for (const item of itemsSG) {
        const { data: confsActivas } = await supabase
          .from('oc_confirmaciones_items')
          .select('subtotal_bruto_conf, oc_confirmaciones!inner(estado)')
          .eq('item_id', item.id)
          .neq('oc_confirmaciones.estado', 'anulada')
        montos[item.id] = (confsActivas || []).reduce((sum: number, c: any) => sum + c.subtotal_bruto_conf, 0)
      }
      setMontosConfirmadosSG(montos)
    }

    if (confsData.data) {
      const confsConTotales = await Promise.all(confsData.data.map(async (conf: any) => {
        const { data: items } = await supabase
          .from('oc_confirmaciones_items')
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

  const totalBruto = items.reduce((sum, i) => sum + i.subtotal, 0)
  const totalCondiciones = condiciones.reduce((sum, c) => sum + c.monto_calculado, 0)
  const totalNeto = totalBruto + totalCondiciones

  // Separar IVA de imp. adicionales
  const impuestosIVA = impuestos.filter(i => i.impuestos?.tipo === 'iva')
  const impuestosAdicionales = impuestos.filter(i => i.impuestos?.tipo !== 'iva')
  const totalIVA = impuestosIVA.reduce((sum, i) => sum + i.monto_calculado, 0)
  const totalAdicionales = impuestosAdicionales.reduce((sum, i) => sum + i.monto_calculado, 0)
  const totalFinal = totalNeto + totalIVA + totalAdicionales

  async function emitirOC() {
    if (!window.confirm('¿Emitir esta OC? No podrá ser editada nuevamente.')) return
    setEmitiendo(true)
    const { error } = await supabase.from('ordenes_compra').update({ estado: 'emitida' }).eq('id', id)
    if (error) { alert('Error: ' + error.message); setEmitiendo(false); return }
    alert('OC emitida exitosamente')
    cargarTodo()
    setEmitiendo(false)
  }

  async function anularOC() {
    if (!window.confirm('¿Anular esta OC? Esta acción no se puede deshacer.')) return
    setAnulando(true)
    const { error } = await supabase.from('ordenes_compra').update({ estado: 'anulada', documento_abierto: false }).eq('id', id)
    if (error) { alert('Error: ' + error.message); setAnulando(false); return }
    alert('OC anulada')
    cargarTodo()
    setAnulando(false)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>
  if (!oc) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">OC no encontrada</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/compras')} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
          <h1 className="text-2xl font-semibold text-gray-800">Orden de Compra</h1>
        </div>

        {/* CABECERA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Número</p>
              <p className="text-lg font-semibold text-gray-800">{oc.numero}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Estado</p>
              <span className={`text-sm px-2 py-1 rounded font-medium ${
                oc.estado === 'borrador' ? 'bg-gray-100 text-gray-700' :
                oc.estado === 'emitida' ? 'bg-blue-100 text-blue-700' :
                'bg-red-100 text-red-700'
              }`}>
                {oc.estado === 'borrador' ? 'Borrador' :
                 oc.estado === 'emitida' ? 'Emitida' : 'Anulada'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Proveedor</p>
              <p className="text-sm text-gray-800">{oc.entidades?.razon_social}</p>
              <p className="text-xs text-gray-500">{oc.entidades?.rut}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fecha</p>
              <p className="text-sm text-gray-800">{new Date(oc.fecha).toLocaleDateString('es-CL')}</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 mb-1">Observaciones</p>
            <p className="text-sm text-gray-700">{oc.observaciones || '—'}</p>
          </div>
        </div>

        {/* ÍTEMS */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Ítems</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-600 font-medium">#</th>
                  <th className="text-left py-2 text-gray-600 font-medium">Código</th>
                  <th className="text-left py-2 text-gray-600 font-medium">Descripción</th>
                  <th className="text-center py-2 text-gray-600 font-medium">Unidad</th>
                  <th className="text-right py-2 text-gray-600 font-medium">Cantidad</th>
                  <th className="text-right py-2 text-gray-600 font-medium">Confirmada</th>
                  <th className="text-right py-2 text-gray-600 font-medium">Disponible</th>
                  <th className="text-right py-2 text-gray-600 font-medium">Precio u.</th>
                  <th className="text-right py-2 text-gray-600 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const esServicioGlobal = item.bienes_servicios?.unidad === 'Servicio Global'
                  const montoConfirmado = montosConfirmadosSG[item.id] || 0
                  const montoDisponible = item.precio_unitario - montoConfirmado
                  return (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 font-semibold text-gray-700">{item.numero_item}</td>
                      <td className="py-3 font-mono text-xs text-gray-600">{item.bienes_servicios?.codigo || '—'}</td>
                      <td className="py-3 text-gray-700">{item.descripcion}</td>
                      <td className="py-3 text-center text-gray-600">{item.bienes_servicios?.unidad || '—'}</td>
                      <td className="py-3 text-right font-mono text-gray-700">
                        {esServicioGlobal ? '—' : item.cantidad}
                      </td>
                      <td className="py-3 text-right font-mono text-gray-700">
                        {esServicioGlobal
                          ? <span className="text-xs text-gray-500">{fmt(montoConfirmado)}</span>
                          : (item.cantidad_confirmada || 0)}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {esServicioGlobal
                          ? <span className={montoDisponible <= 0 ? 'text-red-500' : 'text-green-600'}>{fmt(montoDisponible)}</span>
                          : <span className={item.cantidad - (item.cantidad_confirmada || 0) <= 0 ? 'text-red-500' : 'text-green-600'}>
                              {item.cantidad - (item.cantidad_confirmada || 0)}
                            </span>
                        }
                      </td>
                      <td className="py-3 text-right font-mono text-gray-700">{fmt(item.precio_unitario)}</td>
                      <td className="py-3 text-right font-mono font-medium text-gray-800">{fmt(item.subtotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CONDICIONES */}
        {condiciones.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Condiciones de precio</h2>
            <div className="space-y-2">
              {condiciones.map(c => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{c.tipo === 'descuento' ? '−' : '+'} {c.condiciones_precio?.nombre}</span>
                  <span className="font-mono text-gray-800">{fmt(c.monto_calculado)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IMPUESTOS */}
        {impuestos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Impuestos</h2>
            <div className="space-y-2">
              {impuestos.map(i => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span className={`${i.impuestos?.tipo === 'iva' ? 'text-blue-700' : 'text-orange-700'}`}>
                    {i.impuestos?.codigo} · {i.impuestos?.nombre} · {i.porcentaje}%
                  </span>
                  <span className="font-mono text-gray-800">{fmt(i.monto_calculado)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOTALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal bruto</span>
                <span className="font-mono">{fmt(totalBruto)}</span>
              </div>
              {totalCondiciones !== 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Condiciones</span>
                  <span className="font-mono">{fmt(totalCondiciones)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700 font-medium border-t border-gray-100 pt-2">
                <span>Total neto</span>
                <span className="font-mono">{fmt(totalNeto)}</span>
              </div>
              {Object.values(
  impuestosIVA.reduce((acc: any, i) => {
    const key = i.impuesto_id
    if (!acc[key]) acc[key] = { nombre: `IVA ${i.porcentaje}%`, total: 0 }
    acc[key].total += i.monto_calculado
    return acc
  }, {})
).map((g: any, idx) => (
  <div key={idx} className="flex justify-between text-blue-600">
    <span>+ {g.nombre}</span>
    <span className="font-mono">{fmt(g.total)}</span>
  </div>
))}
{Object.values(
  impuestosAdicionales.reduce((acc: any, i) => {
    const key = i.impuesto_id
    if (!acc[key]) acc[key] = { nombre: `${i.impuestos?.nombre} ${i.porcentaje}%`, total: 0 }
    acc[key].total += i.monto_calculado
    return acc
  }, {})
).map((g: any, idx) => (
  <div key={idx} className="flex justify-between text-orange-600">
    <span>+ {g.nombre}</span>
    <span className="font-mono">{fmt(g.total)}</span>
  </div>
))}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-800 text-base">
                <span>Total</span>
                <span className="font-mono">{fmt(totalFinal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CONFIRMACIONES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Confirmaciones de compra</h2>
            <div className="flex gap-2">
              {confirmaciones.length > 0 && (
                <button onClick={() => router.push(`/compras/${id}/confirmaciones`)} className="text-xs bg-gray-600 text-white px-3 py-1.5 rounded hover:bg-gray-700">
                  Ver todas
                </button>
              )}
              {oc.estado === 'emitida' && oc.documento_abierto && (
                <button onClick={() => router.push(`/compras/${id}/confirmar`)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                  + Nueva confirmación
                </button>
              )}
            </div>
          </div>

          {confirmaciones.length === 0 ? (
            <p className="text-sm text-gray-400">Sin confirmaciones</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-600 font-medium">Confirmación</th>
                    <th className="text-left py-2 text-gray-600 font-medium">Fecha</th>
                    <th className="text-right py-2 text-gray-600 font-medium">Total neto</th>
                    <th className="text-center py-2 text-gray-600 font-medium">Estado</th>
                    <th className="text-center py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {confirmaciones.map(conf => (
                    <tr key={conf.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 font-mono text-blue-600 font-medium">{conf.numero_confirmacion}</td>
                      <td className="py-3 text-gray-700">{new Date(conf.fecha_confirmacion).toLocaleDateString('es-CL')}</td>
                      <td className="py-3 text-right font-mono text-gray-800">{fmt(conf.total_neto)}</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          conf.estado === 'pending_factura' ? 'bg-yellow-50 text-yellow-700' :
                          conf.estado === 'facturada' ? 'bg-green-50 text-green-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {conf.estado === 'pending_factura' ? 'Pendiente factura' :
                           conf.estado === 'facturada' ? 'Facturada' : 'Anulada'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <button onClick={() => router.push(`/compras/${id}/confirmaciones/${conf.id}`)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
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

        {/* ACCIONES */}
        <div className="flex justify-end gap-3">
          {oc.estado === 'borrador' && oc.documento_abierto && (
            <>
              <button onClick={() => router.push(`/compras/${id}/editar`)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                Editar
              </button>
              <button onClick={emitirOC} disabled={emitiendo} className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {emitiendo ? 'Emitiendo...' : 'Emitir OC'}
              </button>
              <button onClick={anularOC} disabled={anulando} className="px-6 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {anulando ? 'Anulando...' : 'Anular'}
              </button>
            </>
          )}
          {(oc.estado === 'emitida' || oc.estado === 'anulada') && (
            <span className="text-sm text-gray-500 px-4 py-2">OC {oc.estado}</span>
          )}
        </div>

      </div>
    </div>
  )
}