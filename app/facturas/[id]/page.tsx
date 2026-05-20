'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DetalleFacturaPage() {
  const { id } = useParams()
  const router = useRouter()

  const [factura, setFactura] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [impuestos, setImpuestos] = useState<any[]>([])
  const [condiciones, setCondiciones] = useState<any[]>([])
  const [confirmaciones, setConfirmaciones] = useState<any[]>([])
  const [facturaRef, setFacturaRef] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [anulando, setAnulando] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)

  useEffect(() => { cargarTodo() }, [id])

  async function cargarTodo() {
    setLoading(true)

    const { data: f } = await supabase
      .from('facturas')
      .select('*, entidades(razon_social, rut)')
      .eq('id', id).single()

    if (!f) { setLoading(false); return }
    setFactura(f)

    const esConConfirmaciones = f.tipo === 'C1G' || f.tipo === 'V1G'
    const esConItems = !esConConfirmaciones

    await Promise.all([
      // Ítems (C2G, V2G, ND, NC)
      esConItems ? supabase.from('factura_items')
        .select('*, bienes_servicios(codigo, unidad)')
        .eq('factura_id', id).order('numero_item')
        .then(r => { if (r.data) setItems(r.data) }) : Promise.resolve(),

      // Impuestos de todos los tipos
      supabase.from('factura_impuestos')
        .select('*, impuestos(codigo, nombre, tipo, porcentaje)')
        .eq('factura_id', id)
        .then(r => { if (r.data) setImpuestos(r.data) }),

      // Condiciones (C2G, V2G, ND, NC)
      esConItems ? supabase.from('factura_condiciones')
        .select('*, condiciones_precio(nombre, tipo)')
        .eq('factura_id', id)
        .then(r => { if (r.data) setCondiciones(r.data) }) : Promise.resolve(),

      // Confirmaciones (C1G, V1G)
      esConConfirmaciones ? (async () => {
        const tabla = f.tipo === 'C1G' ? 'oc_confirmaciones' : 'pv_confirmaciones'
        const { data: fcs } = await supabase.from('factura_confirmaciones')
          .select('confirmacion_id, subtotal_neto').eq('factura_id', id)
        if (fcs && fcs.length > 0) {
          const ids = fcs.map((c: any) => c.confirmacion_id)
          const { data: confs } = await supabase.from(tabla)
            .select('id, numero_confirmacion, fecha_confirmacion, estado')
            .in('id', ids)
          if (confs) {
            const merged = confs.map((c: any) => ({
              ...c,
              subtotal_neto: fcs.find((fc: any) => fc.confirmacion_id === c.id)?.subtotal_neto || 0
            }))
            setConfirmaciones(merged)
          }
        }
      })() : Promise.resolve(),

      // Factura referenciada (ND, NC)
      f.factura_referencia_id ? supabase.from('facturas')
        .select('id, numero_folio, tipo, entidades(razon_social)')
        .eq('id', f.factura_referencia_id).single()
        .then(r => { if (r.data) setFacturaRef(r.data) }) : Promise.resolve(),
    ])

    setLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  const tipoLabel: Record<string, string> = {
    C1G: 'Factura Compra OC', C2G: 'Factura Compra Directa',
    V1G: 'Factura Venta PV', V2G: 'Factura Venta Directa',
    ND: 'Nota de Débito', NC: 'Nota de Crédito'
  }

  const tipoColor: Record<string, string> = {
    C1G: 'bg-blue-100 text-blue-700', C2G: 'bg-blue-100 text-blue-700',
    V1G: 'bg-green-100 text-green-700', V2G: 'bg-green-100 text-green-700',
    ND: 'bg-orange-100 text-orange-700', NC: 'bg-purple-100 text-purple-700'
  }

  // Totales desde items (C2G, V2G, ND, NC)
  const totalBrutoItems = items.reduce((sum, i) => sum + i.subtotal, 0)
  const totalCondItems = condiciones.reduce((sum, c) => sum + c.monto_calculado, 0)
  const impuestosIVA = impuestos.filter(i => i.impuestos?.tipo === 'iva')
  const impuestosAdic = impuestos.filter(i => i.impuestos?.tipo !== 'iva')
  const totalIVA = impuestosIVA.reduce((sum, i) => sum + i.monto_calculado, 0)
  const totalAdic = impuestosAdic.reduce((sum, i) => sum + i.monto_calculado, 0)

  async function emitir() {
    if (!window.confirm('¿Emitir esta factura? El estado cambiará a emitida.')) return
    setEmitiendo(true)
    const { error } = await supabase.from('facturas').update({ estado: 'emitida' }).eq('id', id)
    if (error) { alert('Error: ' + error.message); setEmitiendo(false); return }

    // Si es C1G/V1G, marcar confirmaciones como facturadas
    if (factura?.tipo === 'C1G' || factura?.tipo === 'V1G') {
      const tabla = factura.tipo === 'C1G' ? 'oc_confirmaciones' : 'pv_confirmaciones'
      const confIds = confirmaciones.map(c => c.id)
      if (confIds.length > 0) {
        await supabase.from(tabla).update({ estado: 'facturada' }).in('id', confIds)
      }
    }

    cargarTodo()
    setEmitiendo(false)
  }

  async function anular() {
    if (!window.confirm('¿Anular esta factura? Esta acción no se puede deshacer.')) return
    setAnulando(true)
    const { error } = await supabase.from('facturas').update({ estado: 'anulada' }).eq('id', id)
    if (error) { alert('Error: ' + error.message); setAnulando(false); return }

    // Si es C1G/V1G, devolver confirmaciones a pending_factura
    if (factura?.tipo === 'C1G' || factura?.tipo === 'V1G') {
      const tabla = factura.tipo === 'C1G' ? 'oc_confirmaciones' : 'pv_confirmaciones'
      const confIds = confirmaciones.map(c => c.id)
      if (confIds.length > 0) {
        await supabase.from(tabla).update({ estado: 'pending_factura' }).in('id', confIds)
      }
    }

    cargarTodo()
    setAnulando(false)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>
  if (!factura) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Factura no encontrada</div>

  const esConItems = factura.tipo !== 'C1G' && factura.tipo !== 'V1G'
  const esConConfirmaciones = factura.tipo === 'C1G' || factura.tipo === 'V1G'
  const esNDNC = factura.tipo === 'ND' || factura.tipo === 'NC'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/facturas')} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
          <h1 className="text-2xl font-semibold text-gray-800">Detalle Factura</h1>
        </div>

        {/* CABECERA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Folio</p>
              <p className="text-xl font-semibold text-gray-800 font-mono">{factura.numero_folio || '—'}</p>
            </div>
            <div className="flex gap-3 items-start">
              <div>
                <p className="text-xs text-gray-500 mb-1">Tipo</p>
                <span className={`text-xs px-2 py-1 rounded font-medium ${tipoColor[factura.tipo] || 'bg-gray-100 text-gray-700'}`}>
                  {tipoLabel[factura.tipo] || factura.tipo}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Estado</p>
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  factura.estado === 'borrador' ? 'bg-gray-100 text-gray-700' :
                  factura.estado === 'emitida' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {factura.estado === 'borrador' ? 'Borrador' :
                   factura.estado === 'emitida' ? 'Emitida' : 'Anulada'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{factura.flujo === 'compra' ? 'Proveedor' : 'Cliente'}</p>
              <p className="text-sm font-medium text-gray-800">{factura.entidades?.razon_social}</p>
              <p className="text-xs text-gray-500">{factura.entidades?.rut}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fecha</p>
              <p className="text-sm text-gray-800">{new Date(factura.fecha).toLocaleDateString('es-CL')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Moneda</p>
              <p className="text-sm text-gray-800">{factura.moneda}</p>
            </div>
            {factura.observaciones && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Observaciones</p>
                <p className="text-sm text-gray-700">{factura.observaciones}</p>
              </div>
            )}
          </div>
        </div>

        {/* FACTURA REFERENCIADA (ND/NC) */}
        {esNDNC && facturaRef && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-4">
            <p className="text-xs text-orange-700 font-medium uppercase tracking-wide mb-2">Factura referenciada</p>
            <div className="flex items-center gap-4">
              <span className="text-sm font-mono font-medium text-orange-700">{facturaRef.numero_folio}</span>
              <span className="text-xs text-gray-500">Tipo: {facturaRef.tipo}</span>
              <span className="text-xs text-gray-500">{facturaRef.entidades?.razon_social}</span>
              <button onClick={() => router.push(`/facturas/${facturaRef.id}`)} className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-auto">
                Ver →
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMACIONES (C1G / V1G) */}
        {esConConfirmaciones && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">
              Confirmaciones {factura.tipo === 'C1G' ? 'de compra' : 'de venta'}
            </h2>
            {confirmaciones.length === 0 ? (
              <p className="text-sm text-gray-400">Sin confirmaciones asociadas</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-600 font-medium">N° Confirmación</th>
                    <th className="text-left py-2 text-gray-600 font-medium">Fecha</th>
                    <th className="text-center py-2 text-gray-600 font-medium">Estado</th>
                    <th className="text-right py-2 text-gray-600 font-medium">Subtotal neto</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmaciones.map(c => (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td className="py-3 font-mono text-blue-600 font-medium">{c.numero_confirmacion}</td>
                      <td className="py-3 text-gray-700">{new Date(c.fecha_confirmacion).toLocaleDateString('es-CL')}</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          c.estado === 'facturada' ? 'bg-green-50 text-green-700' :
                          c.estado === 'pending_factura' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {c.estado === 'facturada' ? 'Facturada' :
                           c.estado === 'pending_factura' ? 'Pendiente' : 'Anulada'}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono text-gray-800">{fmt(c.subtotal_neto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Comparativo propuesto vs real (C1G / V1G) */}
            {(factura.neto_propuesto != null) && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Cuadre propuesto vs real</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div></div>
                  <div className="text-center text-xs text-gray-500 font-medium uppercase">Propuesto</div>
                  <div className="text-center text-xs text-gray-500 font-medium uppercase">Real</div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mt-1">
                  <div className="text-gray-600">Neto</div>
                  <div className="text-right font-mono text-gray-700">{fmt(factura.neto_propuesto)}</div>
                  <div className="text-right font-mono text-gray-700">{fmt(factura.neto_real)}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mt-1">
                  <div className="text-blue-600">IVA</div>
                  <div className="text-right font-mono text-blue-600">{fmt(factura.iva_propuesto)}</div>
                  <div className="text-right font-mono text-blue-600">{fmt(factura.iva_real)}</div>
                </div>
                {(factura.diferencia_neto !== 0 || factura.diferencia_iva !== 0) && (
                  <div className="grid grid-cols-3 gap-4 text-sm mt-2 bg-yellow-50 rounded p-2">
                    <div className="text-yellow-700 font-medium">Diferencia</div>
                    <div></div>
                    <div className="text-right font-mono text-yellow-700">{fmt((factura.diferencia_neto || 0) + (factura.diferencia_iva || 0))}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ÍTEMS (C2G, V2G, ND, NC) */}
        {esConItems && items.length > 0 && (
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
                    <th className="text-right py-2 text-gray-600 font-medium">Precio u.</th>
                    <th className="text-right py-2 text-gray-600 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-3 font-semibold text-gray-700">{item.numero_item}</td>
                      <td className="py-3 font-mono text-xs text-gray-600">{item.bienes_servicios?.codigo || '—'}</td>
                      <td className="py-3 text-gray-700">{item.descripcion}</td>
                      <td className="py-3 text-center text-gray-600">{item.bienes_servicios?.unidad || '—'}</td>
                      <td className="py-3 text-right font-mono text-gray-700">{item.cantidad}</td>
                      <td className="py-3 text-right font-mono text-gray-700">{fmt(item.precio_unitario)}</td>
                      <td className="py-3 text-right font-mono font-medium text-gray-800">{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Condiciones e impuestos de ítems */}
            {condiciones.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-2">Condiciones de precio</p>
                {condiciones.map(c => (
                  <div key={c.id} className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{c.condiciones_precio?.tipo === 'descuento' ? '−' : '+'} {c.condiciones_precio?.nombre}</span>
                    <span className="font-mono text-gray-700">{fmt(Math.abs(c.monto_calculado))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IMPUESTOS */}
        {impuestos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Impuestos</h2>
            <div className="space-y-2">
              {impuestos.map(i => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span className={i.impuestos?.tipo === 'iva' ? 'text-blue-700' : 'text-orange-700'}>
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
              {esConItems && (
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal bruto</span>
                  <span className="font-mono">{fmt(totalBrutoItems)}</span>
                </div>
              )}
              {totalCondItems !== 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>{totalCondItems < 0 ? '− ' : '+ '}Condiciones</span>
                  <span className="font-mono">{fmt(Math.abs(totalCondItems))}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700 font-medium border-t border-gray-100 pt-2">
                <span>Total neto</span>
                <span className="font-mono">{fmt(factura.total_neto)}</span>
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
              {totalAdic > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>+ Imp. Adicionales</span>
                  <span className="font-mono">{fmt(totalAdic)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-100 pt-2 text-base">
                <span>Total</span>
                <span className="font-mono">{fmt(factura.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ACCIONES */}
        <div className="flex justify-end gap-3">
          {factura.estado === 'borrador' && (
            <>
              <button onClick={emitir} disabled={emitiendo}
                className="px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {emitiendo ? 'Emitiendo...' : 'Emitir'}
              </button>
              <button onClick={anular} disabled={anulando}
                className="px-6 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {anulando ? 'Anulando...' : 'Anular'}
              </button>
            </>
          )}
          {factura.estado === 'emitida' && (
            <button onClick={anular} disabled={anulando}
              className="px-6 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
              {anulando ? 'Anulando...' : 'Anular factura'}
            </button>
          )}
          {factura.estado === 'anulada' && (
            <span className="text-sm text-gray-500 px-4 py-2">Factura anulada</span>
          )}
        </div>

      </div>
    </div>
  )
}
