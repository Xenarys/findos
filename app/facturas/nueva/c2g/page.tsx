'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/app/context/empresa'

interface BienServicio {
  id: string; codigo: string; descripcion: string; clasificacion: string
  unidad: string; moneda: string; afecto_iva_compra: boolean
  esquema_tributario_compra_id: string | null
}
interface Entidad { id: string; razon_social: string; rut: string }
interface Impuesto {
  id: string; codigo: string; nombre: string; porcentaje: number
  tipo: string; flujo: string; cuenta_id: string | null
  fecha_desde: string | null; fecha_hasta: string | null
}
interface CondicionPrecio { id: string; nombre: string; abreviatura: string; tipo: string; forma_calculo: string; nivel: string; requiere_cuenta: boolean; cuenta_id: string | null }

interface ItemImpuesto {
  impuesto_id: string; codigo: string; nombre: string
  porcentaje: number; monto_calculado: number
  es_automatico: boolean; cuenta_id: string | null; tipo: string
}
interface ItemCondicion {
  condicion_precio_id: string; nombre: string; abreviatura: string
  tipo: string; forma_calculo: string; valor: number
  monto_calculado: number; requiere_cuenta: boolean; cuenta_id: string | null
}
interface ItemForm {
  bien_servicio_id: string; descripcion: string
  cantidad: number; precio_unitario: number; subtotal_bruto: number
  bien?: BienServicio; impuestos: ItemImpuesto[]
  condiciones: ItemCondicion[]; cuenta_id: string | null
}

export default function NuevaFacturaC2GPage() {
  const router = useRouter()
  const { empresaActual } = useEmpresa()

  const [proveedores, setProveedores] = useState<Entidad[]>([])
  const [bienes, setBienes] = useState<BienServicio[]>([])
  const [impuestosDisp, setImpuestosDisp] = useState<Impuesto[]>([])
  const [condPrecioDisp, setCondPrecioDisp] = useState<CondicionPrecio[]>([])
  const [esquemaImpuestos, setEsquemaImpuestos] = useState<Record<string, any[]>>({})
  const [operacionC1G, setOperacionC1G] = useState<string | null>(null)

  const [proveedorId, setProveedorId] = useState('')
  const [folio, setFolio] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [moneda, setMoneda] = useState('CLP')
  const [tasaCambio, setTasaCambio] = useState(1)
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<ItemForm[]>([])
  const [bienSeleccionado, setBienSeleccionado] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const [provs, bs, imps, conds] = await Promise.all([
      supabase.from('entidades').select('id, razon_social, rut').eq('tipo_proveedor', true).eq('activo', true).order('razon_social'),
      supabase.from('bienes_servicios').select('id, codigo, descripcion, clasificacion, unidad, moneda, afecto_iva_compra, esquema_tributario_compra_id').eq('activo', true).order('descripcion'),
      supabase.from('impuestos').select('id, codigo, nombre, porcentaje, tipo, flujo, cuenta_id, fecha_desde, fecha_hasta').eq('activo', true).eq('flujo', 'compra').order('codigo'),
      supabase.from('condiciones_precio').select('id, nombre, abreviatura, tipo, forma_calculo, nivel, requiere_cuenta, cuenta_id').eq('activo', true).order('nombre'),
    ])
    if (provs.data) setProveedores(provs.data)
    if (bs.data) setBienes(bs.data)
    if (imps.data) setImpuestosDisp(imps.data)
    if (conds.data) setCondPrecioDisp(conds.data)
    setLoading(false)
  }

  async function cargarEsquema(esquemaId: string): Promise<any[]> {
    if (esquemaImpuestos[esquemaId]) return esquemaImpuestos[esquemaId]
    const { data } = await supabase
      .from('esquema_impuestos')
      .select('impuesto_id, impuestos(id, codigo, nombre, porcentaje, tipo, flujo, cuenta_id)')
      .eq('esquema_id', esquemaId)
    const resultado = (data || []) as any[]
    setEsquemaImpuestos(prev => ({ ...prev, [esquemaId]: resultado }))
    return resultado
  }

  function buscarIVAVigente(): Impuesto | null {
    const vigentes = impuestosDisp.filter(i =>
      i.tipo === 'iva' && i.flujo === 'compra' &&
      i.fecha_desde !== null && i.fecha_desde <= fecha &&
      (i.fecha_hasta === null || i.fecha_hasta >= fecha)
    )
    return vigentes.length > 0 ? vigentes[0] : null
  }

  async function resolverCuenta(bien: BienServicio): Promise<string | null> {
    let opId = operacionC1G
    if (!opId) {
      const { data: op } = await supabase.from('operaciones_contables').select('id').eq('codigo', 'C1G').single()
      if (op) { setOperacionC1G(op.id); opId = op.id }
    }
    if (!opId) return null
    const { data: clas } = await supabase.from('clasificaciones').select('id').eq('nombre', bien.clasificacion).single()
    if (!clas) return null
    const { data: cc } = await supabase.from('clasificacion_cuentas').select('cuenta_id').eq('clasificacion_id', clas.id).eq('operacion_id', opId).single()
    return cc?.cuenta_id || null
  }

  async function agregarItem() {
    if (!bienSeleccionado) return alert('Selecciona un bien o servicio')
    const bien = bienes.find(b => b.id === bienSeleccionado)
    if (!bien) return
    const cuenta = await resolverCuenta(bien)
    let impuestosAuto: ItemImpuesto[] = []

    if (bien.afecto_iva_compra) {
      const iva = buscarIVAVigente()
      if (!iva) { alert(`El bien es afecto a IVA pero no hay IVA vigente para la fecha ${fecha}.`); return }
      impuestosAuto = [{ impuesto_id: iva.id, codigo: iva.codigo, nombre: iva.nombre, porcentaje: iva.porcentaje, monto_calculado: 0, es_automatico: true, cuenta_id: iva.cuenta_id || null, tipo: iva.tipo }]
    }

    if (bien.esquema_tributario_compra_id) {
      const esq = await cargarEsquema(bien.esquema_tributario_compra_id)
      const adic = esq.filter(ei => ei.impuestos?.flujo === 'compra' && ei.impuestos?.tipo !== 'iva')
        .map(ei => ({ impuesto_id: ei.impuesto_id, codigo: ei.impuestos.codigo, nombre: ei.impuestos.nombre, porcentaje: ei.impuestos.porcentaje, monto_calculado: 0, es_automatico: true, cuenta_id: ei.impuestos.cuenta_id || null, tipo: ei.impuestos.tipo }))
      impuestosAuto = [...impuestosAuto, ...adic]
    }

    setItems([...items, { bien_servicio_id: bien.id, descripcion: bien.descripcion, cantidad: 1, precio_unitario: 0, subtotal_bruto: 0, bien, impuestos: impuestosAuto, condiciones: [], cuenta_id: cuenta }])
    setBienSeleccionado('')
  }

  function calcularItem(item: ItemForm): ItemForm {
    const subtotal_bruto = item.cantidad * item.precio_unitario
    let base = subtotal_bruto
    const condiciones = item.condiciones.map(c => {
      let monto = 0
      if (c.forma_calculo === 'porcentual') monto = subtotal_bruto * c.valor / 100
      else if (c.forma_calculo === 'monto_fijo') monto = c.valor
      else if (c.forma_calculo === 'monto_unidad') monto = c.valor * item.cantidad
      if (c.tipo === 'descuento') base -= monto
      else base += monto
      return { ...c, monto_calculado: c.tipo === 'descuento' ? -monto : monto }
    })
    const impuestos = item.impuestos.map(imp => ({ ...imp, monto_calculado: Math.round(base * imp.porcentaje / 100) }))
    return { ...item, subtotal_bruto, condiciones, impuestos }
  }

  function actualizarItem(idx: number, campo: string, valor: any) {
    const nuevos = [...items]
    nuevos[idx] = calcularItem({ ...nuevos[idx], [campo]: valor })
    setItems(nuevos)
  }

  function agregarImpuestoItem(idx: number, impId: string) {
    const imp = impuestosDisp.find(i => i.id === impId)
    if (!imp) return
    if (items[idx].impuestos.some(i => i.impuesto_id === impId)) return alert('Ya está en el ítem')
    const nuevos = [...items]
    nuevos[idx] = calcularItem({ ...nuevos[idx], impuestos: [...nuevos[idx].impuestos, { impuesto_id: imp.id, codigo: imp.codigo, nombre: imp.nombre, porcentaje: imp.porcentaje, monto_calculado: 0, es_automatico: false, cuenta_id: imp.cuenta_id || null, tipo: imp.tipo }] })
    setItems(nuevos)
  }

  function eliminarImpuestoItem(idx: number, impId: string) {
    const nuevos = [...items]
    nuevos[idx] = calcularItem({ ...nuevos[idx], impuestos: nuevos[idx].impuestos.filter(i => i.impuesto_id !== impId) })
    setItems(nuevos)
  }

  function agregarCondicionItem(idx: number, condId: string) {
    const cond = condPrecioDisp.find(c => c.id === condId)
    if (!cond) return
    if (items[idx].condiciones.some(c => c.condicion_precio_id === condId)) return alert('Ya está en el ítem')
    const nuevos = [...items]
    nuevos[idx] = calcularItem({ ...nuevos[idx], condiciones: [...nuevos[idx].condiciones, { condicion_precio_id: cond.id, nombre: cond.nombre, abreviatura: cond.abreviatura, tipo: cond.tipo, forma_calculo: cond.forma_calculo, valor: 0, monto_calculado: 0, requiere_cuenta: cond.requiere_cuenta ?? false, cuenta_id: cond.cuenta_id || null }] })
    setItems(nuevos)
  }

  function actualizarCondicionItem(idx: number, condId: string, valor: number) {
    const nuevos = [...items]
    nuevos[idx] = calcularItem({ ...nuevos[idx], condiciones: nuevos[idx].condiciones.map(c => c.condicion_precio_id === condId ? { ...c, valor } : c) })
    setItems(nuevos)
  }

  function eliminarCondicionItem(idx: number, condId: string) {
    const nuevos = [...items]
    nuevos[idx] = calcularItem({ ...nuevos[idx], condiciones: nuevos[idx].condiciones.filter(c => c.condicion_precio_id !== condId) })
    setItems(nuevos)
  }

  function eliminarItem(idx: number) { setItems(items.filter((_, i) => i !== idx)) }

  const totalBruto = items.reduce((sum, i) => sum + i.subtotal_bruto, 0)
  const totalCondItems = items.reduce((sum, i) => sum + i.condiciones.reduce((s, c) => s + c.monto_calculado, 0), 0)
  const totalNeto = totalBruto + totalCondItems
  const ivaItems = items.flatMap(i => i.impuestos.filter(imp => imp.tipo === 'iva'))
  const totalIVA = ivaItems.reduce((sum, imp) => sum + imp.monto_calculado, 0)
  const ivaInfo = ivaItems.length > 0 ? { porcentaje: ivaItems[0].porcentaje } : null
  const totalImpAdic = items.reduce((sum, i) => sum + i.impuestos.filter(imp => imp.tipo !== 'iva').reduce((s, imp) => s + imp.monto_calculado, 0), 0)
  const totalFinal = totalNeto + totalIVA + totalImpAdic
  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))
  const impuestosAdicionales = impuestosDisp.filter(i => i.tipo !== 'iva')

  async function guardar(emitir: boolean) {
    if (!proveedorId) return alert('Selecciona un proveedor')
    if (items.length === 0) return alert('Agrega al menos un ítem')
    if (emitir && !folio.trim()) return alert('El número de folio es obligatorio para emitir')
    setGuardando(true)

    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()

    const { data: facturaData, error } = await supabase.from('facturas').insert([{
      numero_folio: folio.trim() || null,
      tipo: 'C2G', flujo: 'compra',
      entidad_id: proveedorId, fecha, moneda, tasa_cambio: tasaCambio,
      estado: emitir ? 'emitida' : 'borrador',
      observaciones: observaciones || null,
      total_neto: totalNeto, total_impuestos: totalIVA + totalImpAdic, total: totalFinal,
      empresa_id: empresaActual!.id,
      created_by: user?.email, updated_by: user?.email, updated_at: ahora
    }]).select()

    if (error || !facturaData) { alert('Error: ' + error?.message); setGuardando(false); return }
    const factura_id = facturaData[0].id

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]
      const { data: itemData } = await supabase.from('factura_items').insert([{
        factura_id, bien_servicio_id: item.bien_servicio_id,
        descripcion: item.descripcion, cantidad: item.cantidad,
        precio_unitario: item.precio_unitario, subtotal: item.subtotal_bruto,
        numero_item: idx + 1, cuenta_id: item.cuenta_id, created_by: user?.email
      }]).select()

      if (itemData && itemData[0]) {
        const itemId = itemData[0].id
        if (item.impuestos.length > 0) {
          await supabase.from('factura_impuestos').insert(item.impuestos.map(imp => ({
            factura_id, item_id: itemId, impuesto_id: imp.impuesto_id,
            nivel: 'item', porcentaje: imp.porcentaje, monto_calculado: imp.monto_calculado,
            es_automatico: imp.es_automatico, cuenta_id: imp.cuenta_id, created_by: user?.email
          })))
        }
        if (item.condiciones.length > 0) {
          await supabase.from('factura_condiciones').insert(item.condiciones.map(c => ({
            factura_id, item_id: itemId, condicion_precio_id: c.condicion_precio_id,
            nivel: 'item', valor: c.valor, monto_calculado: c.monto_calculado,
            cuenta_id: c.cuenta_id, created_by: user?.email
          })))
        }
      }
    }

    setGuardando(false)
    router.push(`/facturas/${factura_id}`)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/facturas')} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
          <h1 className="text-2xl font-semibold text-gray-800">Nueva Factura Directa Compra (C2G)</h1>
        </div>

        {/* DATOS GENERALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Datos generales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Proveedor *</label>
              <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— seleccione proveedor —</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} · {p.rut}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">N° Folio / Factura {!folio && <span className="text-orange-500">(requerido para emitir)</span>}</label>
              <input value={folio} onChange={e => setFolio(e.target.value)} placeholder="Ej: 123456" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="UF">UF</option>
              </select>
            </div>
            {moneda !== 'CLP' && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tasa de cambio a CLP *</label>
                <input type="number" value={tasaCambio} onChange={e => setTasaCambio(parseFloat(e.target.value) || 1)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Observaciones</label>
              <input value={observaciones} onChange={e => setObservaciones(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        {/* ÍTEMS */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Ítems</h2>
          <div className="flex gap-3 mb-4">
            <select value={bienSeleccionado} onChange={e => setBienSeleccionado(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— seleccione bien o servicio —</option>
              {bienes.map(b => <option key={b.id} value={b.id}>{b.codigo} · {b.descripcion}</option>)}
            </select>
            <button onClick={agregarItem} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Agregar</button>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay ítems</p>
          ) : (
            <div className="space-y-4">
              {items.map((item, idx) => {
                const esAfecto = item.bien?.afecto_iva_compra === true
                return (
                  <div key={idx} className="border border-gray-100 rounded-lg p-4">
                    <div className="grid grid-cols-12 gap-2 items-center mb-3">
                      <div className="col-span-1">
                        <label className="text-xs text-gray-400 block mb-1">Ítem #</label>
                        <p className="text-sm font-semibold text-gray-700">{idx + 1}</p>
                      </div>
                      <div className="col-span-4">
                        <label className="text-xs text-gray-400 block mb-1">
                          Descripción
                          <span className={`ml-2 px-1 py-0.5 rounded text-xs font-medium ${esAfecto ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{esAfecto ? 'A' : 'E'}</span>
                        </label>
                        <input value={item.descripcion} onChange={e => actualizarItem(idx, 'descripcion', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                      </div>
                      <div className="col-span-1 text-center">
                        <label className="text-xs text-gray-400 block mb-1">Unidad</label>
                        <span className="text-xs text-gray-500">{item.bien?.unidad || '—'}</span>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400 block mb-1">Cantidad</label>
                        <input type="number" value={item.cantidad} min="0" step="0.01" onChange={e => actualizarItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400 block mb-1">Precio unit.</label>
                        <input type="number" value={item.precio_unitario} min="0" onChange={e => actualizarItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400 block mb-1">Subtotal</label>
                        <span className="text-xs font-mono font-medium text-gray-700 block text-right">{fmt(item.subtotal_bruto)}</span>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => eliminarItem(idx)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                      </div>
                    </div>

                    {/* Condiciones */}
                    <div className="mt-2 pl-2 border-l-2 border-amber-100">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-amber-700 font-medium">Condiciones precio</span>
                        <select onChange={e => { if (e.target.value) { agregarCondicionItem(idx, e.target.value); e.target.value = '' } }} className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white">
                          <option value="">+ agregar</option>
                          {condPrecioDisp.filter(c => c.nivel === 'item' || c.nivel === 'ambos').map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                      {item.condiciones.map(c => (
                        <div key={c.condicion_precio_id} className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${c.tipo === 'descuento' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{c.tipo === 'descuento' ? '-' : '+'} {c.abreviatura}</span>
                          <input type="number" value={c.valor} min="0" step="0.01" onChange={e => actualizarCondicionItem(idx, c.condicion_precio_id, parseFloat(e.target.value) || 0)} className="w-20 border border-gray-200 rounded px-2 py-0.5 text-xs text-right" />
                          <span className="text-xs text-gray-400">{c.forma_calculo === 'porcentual' ? '%' : '$'}</span>
                          <span className="text-xs font-mono text-gray-600">{fmt(Math.abs(c.monto_calculado))}</span>
                          <button onClick={() => eliminarCondicionItem(idx, c.condicion_precio_id)} className="text-red-400 text-xs">✕</button>
                        </div>
                      ))}
                    </div>

                    {/* IVA */}
                    {item.impuestos.filter(imp => imp.tipo === 'iva').length > 0 && (
                      <div className="mt-2 pl-2 border-l-2 border-blue-200">
                        <span className="text-xs text-blue-700 font-medium">IVA (automático)</span>
                        {item.impuestos.filter(imp => imp.tipo === 'iva').map(imp => (
                          <div key={imp.impuesto_id} className="flex items-center gap-2 mb-1 mt-1">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{imp.codigo}</span>
                            <span className="text-xs text-gray-500">{imp.porcentaje}%</span>
                            <span className="text-xs font-mono text-gray-600">{fmt(imp.monto_calculado)}</span>
                            <span className="text-xs text-gray-400">(auto)</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Imp. Adicionales */}
                    <div className="mt-2 pl-2 border-l-2 border-orange-100">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-orange-700 font-medium">Imp. Adicionales</span>
                        <select onChange={e => { if (e.target.value) { agregarImpuestoItem(idx, e.target.value); e.target.value = '' } }} className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white">
                          <option value="">+ agregar</option>
                          {impuestosAdicionales.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.nombre}</option>)}
                        </select>
                      </div>
                      {item.impuestos.filter(imp => imp.tipo !== 'iva').map(imp => (
                        <div key={imp.impuesto_id} className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-700">{imp.codigo}</span>
                          <span className="text-xs text-gray-500">{imp.porcentaje}%</span>
                          <span className="text-xs font-mono text-gray-600">{fmt(imp.monto_calculado)}</span>
                          {!imp.es_automatico && <button onClick={() => eliminarImpuestoItem(idx, imp.impuesto_id)} className="text-red-400 text-xs">✕</button>}
                          {imp.es_automatico && <span className="text-xs text-gray-400">(auto)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* TOTALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total bruto</span>
                <span className="font-mono">{fmt(totalBruto)}</span>
              </div>
              <div className="flex justify-between text-gray-700 font-medium border-t border-gray-100 pt-2">
                <span>Total neto</span>
                <span className="font-mono">{fmt(totalNeto)}</span>
              </div>
              {totalIVA > 0 && ivaInfo && (
                <div className="flex justify-between text-blue-600">
                  <span>+ IVA {ivaInfo.porcentaje}%</span>
                  <span className="font-mono">{fmt(totalIVA)}</span>
                </div>
              )}
              {totalImpAdic > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>+ Imp. Adicionales</span>
                  <span className="font-mono">{fmt(totalImpAdic)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-100 pt-2 text-base">
                <span>Total</span>
                <span className="font-mono">{fmt(totalFinal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ACCIONES */}
        <div className="flex justify-end gap-3">
          <button onClick={() => router.push('/facturas')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancelar</button>
          <button onClick={() => guardar(false)} disabled={guardando} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button onClick={() => guardar(true)} disabled={guardando || !folio.trim()} className="px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {guardando ? 'Emitiendo...' : 'Emitir factura'}
          </button>
        </div>
      </div>
    </div>
  )
}