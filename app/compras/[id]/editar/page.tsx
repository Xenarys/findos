'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface BienServicio {
  id: string; codigo: string; descripcion: string; clasificacion: string
  unidad: string; moneda: string; afecto_iva_compra: boolean
  esquema_tributario_compra_id: string | null
}
interface CondicionPago { id: string; nombre: string }
interface Entidad { id: string; razon_social: string; rut: string }
interface Impuesto { id: string; codigo: string; nombre: string; porcentaje: number; tipo_calculo: string; flujo: string; cuenta_id: string | null }
interface CondicionPrecio { id: string; nombre: string; abreviatura: string; tipo: string; forma_calculo: string; nivel: string; requiere_cuenta: boolean; cuenta_id: string | null }
interface EsquemaImpuesto { impuesto_id: string; impuestos: Impuesto }

interface ItemImpuesto {
  impuesto_id: string; codigo: string; nombre: string
  porcentaje: number; monto_calculado: number
  es_automatico: boolean; cuenta_id: string | null
}

interface ItemCondicion {
  condicion_precio_id: string; nombre: string; abreviatura: string
  tipo: string; forma_calculo: string; valor: number
  monto_calculado: number; requiere_cuenta: boolean; cuenta_id: string | null
}

interface ItemForm {
  id?: string
  bien_servicio_id: string; descripcion: string
  cantidad: number; precio_unitario: number
  subtotal_bruto: number; subtotal_neto: number
  bien?: BienServicio; impuestos: ItemImpuesto[]
  condiciones: ItemCondicion[]; cuenta_id: string | null
}

interface CondicionCabecera {
  id?: string; condicion_precio_id: string; nombre: string
  abreviatura: string; tipo: string; forma_calculo: string
  valor: number; monto_calculado: number
}

interface ImpuestoCabecera {
  id?: string; impuesto_id: string; codigo: string
  nombre: string; porcentaje: number; monto_calculado: number
}

export default function EditarOCPage() {
  const { id } = useParams()
  const router = useRouter()

  const [proveedores, setProveedores] = useState<Entidad[]>([])
  const [bienes, setBienes] = useState<BienServicio[]>([])
  const [condicionesPago, setCondicionesPago] = useState<CondicionPago[]>([])
  const [impuestosDisp, setImpuestosDisp] = useState<Impuesto[]>([])
  const [condPrecioDisp, setCondPrecioDisp] = useState<CondicionPrecio[]>([])
  const [esquemaImpuestos, setEsquemaImpuestos] = useState<Record<string, EsquemaImpuesto[]>>({})
  const [operacionC1G, setOperacionC1G] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [loading, setLoading] = useState(true)

  const [cabecera, setCabecera] = useState({
    proveedor_id: '', fecha: new Date().toISOString().split('T')[0],
    condicion_pago_id: '', moneda: 'CLP', observaciones: ''
  })
  const [items, setItems] = useState<ItemForm[]>([])
  const [itemsEliminados, setItemsEliminados] = useState<string[]>([])
  const [condsCabecera, setCondsCabecera] = useState<CondicionCabecera[]>([])
  const [impsCabecera, setImpsCabecera] = useState<ImpuestoCabecera[]>([])
  const [bienSeleccionado, setBienSeleccionado] = useState('')
  const [condSelCab, setCondSelCab] = useState('')
  const [impSelCab, setImpSelCab] = useState('')

  useEffect(() => { cargarTodo() }, [id])

  async function cargarTodo() {
    setLoading(true)
    const [provs, bs, cps, imps, conds, ocData, itemsData, condsOC, impsOC] = await Promise.all([
      supabase.from('entidades').select('id, razon_social, rut').eq('tipo_proveedor', true).eq('activo', true).order('razon_social'),
      supabase.from('bienes_servicios').select('id, codigo, descripcion, clasificacion, unidad, moneda, afecto_iva_compra, esquema_tributario_compra_id').eq('activo', true).order('descripcion'),
      supabase.from('condiciones_pago').select('id, nombre').eq('activo', true).order('dias'),
      supabase.from('impuestos').select('id, codigo, nombre, porcentaje, tipo_calculo, flujo, cuenta_id').eq('activo', true).eq('flujo', 'compra').order('codigo'),
      supabase.from('condiciones_precio').select('id, nombre, abreviatura, tipo, forma_calculo, nivel, requiere_cuenta, cuenta_id').eq('activo', true).order('nombre'),
      supabase.from('ordenes_compra').select('*').eq('id', id).single(),
      supabase.from('ordenes_compra_items').select('*, bienes_servicios(id, codigo, descripcion, clasificacion, unidad, moneda, afecto_iva_compra, esquema_tributario_compra_id)').eq('orden_compra_id', id).order('created_at'),
      supabase.from('oc_condiciones').select('*, condiciones_precio(nombre, abreviatura, tipo, forma_calculo)').eq('orden_compra_id', id),
      supabase.from('oc_impuestos').select('*, impuestos(codigo, nombre, porcentaje)').eq('orden_compra_id', id),
    ])

    if (provs.data) setProveedores(provs.data)
    if (bs.data) setBienes(bs.data)
    if (cps.data) setCondicionesPago(cps.data)
    if (imps.data) setImpuestosDisp(imps.data)
    if (conds.data) setCondPrecioDisp(conds.data)

    if (ocData.data) {
      setCabecera({
        proveedor_id: ocData.data.proveedor_id || '',
        fecha: ocData.data.fecha || '',
        condicion_pago_id: ocData.data.condicion_pago_id || '',
        moneda: ocData.data.moneda || 'CLP',
        observaciones: ocData.data.observaciones || ''
      })
    }

    if (itemsData.data) {
      const itemsConDetalle = await Promise.all(itemsData.data.map(async (i: any) => {
        const impsItem = (impsOC.data || []).filter((imp: any) => imp.item_id === i.id)
        const condsItem = (condsOC.data || []).filter((c: any) => c.item_id === i.id)
        return {
          id: i.id,
          bien_servicio_id: i.bien_servicio_id,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          subtotal_bruto: i.subtotal,
          subtotal_neto: i.subtotal,
          bien: i.bienes_servicios,
          cuenta_id: i.cuenta_id || null,
          impuestos: impsItem.map((imp: any) => ({
            impuesto_id: imp.impuesto_id,
            codigo: imp.impuestos?.codigo || '',
            nombre: imp.impuestos?.nombre || '',
            porcentaje: imp.porcentaje,
            monto_calculado: imp.monto_calculado,
            es_automatico: imp.es_automatico,
            cuenta_id: imp.cuenta_id || null
          })),
          condiciones: condsItem.map((c: any) => ({
            condicion_precio_id: c.condicion_precio_id,
            nombre: c.condiciones_precio?.nombre || '',
            abreviatura: c.condiciones_precio?.abreviatura || '',
            tipo: c.condiciones_precio?.tipo || '',
            forma_calculo: c.condiciones_precio?.forma_calculo || '',
            valor: c.valor,
            monto_calculado: c.monto_calculado,
            requiere_cuenta: false,
            cuenta_id: c.cuenta_id || null
          }))
        }
      }))
      setItems(itemsConDetalle)
    }

    // Condiciones e impuestos de cabecera
    if (condsOC.data) {
      setCondsCabecera((condsOC.data as any[]).filter(c => !c.item_id).map(c => ({
        id: c.id,
        condicion_precio_id: c.condicion_precio_id,
        nombre: c.condiciones_precio?.nombre || '',
        abreviatura: c.condiciones_precio?.abreviatura || '',
        tipo: c.condiciones_precio?.tipo || '',
        forma_calculo: c.condiciones_precio?.forma_calculo || '',
        valor: c.valor,
        monto_calculado: c.monto_calculado
      })))
    }

    if (impsOC.data) {
      setImpsCabecera((impsOC.data as any[]).filter(i => !i.item_id).map(i => ({
        id: i.id,
        impuesto_id: i.impuesto_id,
        codigo: i.impuestos?.codigo || '',
        nombre: i.impuestos?.nombre || '',
        porcentaje: i.porcentaje,
        monto_calculado: i.monto_calculado
      })))
    }

    setLoading(false)
  }

  async function cargarEsquemaImpuestos(esquemaId: string): Promise<EsquemaImpuesto[]> {
    if (esquemaImpuestos[esquemaId]) return esquemaImpuestos[esquemaId]
    const { data } = await supabase
      .from('esquema_impuestos')
      .select('impuesto_id, impuestos(id, codigo, nombre, porcentaje, tipo_calculo, flujo, cuenta_id)')
      .eq('esquema_id', esquemaId)
    const resultado = ((data || []) as any[]) as EsquemaImpuesto[]
    setEsquemaImpuestos(prev => ({ ...prev, [esquemaId]: resultado }))
    return resultado
  }

  async function resolverCuentaItem(bien: BienServicio): Promise<string | null> {
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
    const cuentaItem = await resolverCuentaItem(bien)
    let impuestosAuto: ItemImpuesto[] = []
    if (bien.esquema_tributario_compra_id) {
      const esqImps = await cargarEsquemaImpuestos(bien.esquema_tributario_compra_id)
      impuestosAuto = esqImps.filter(ei => ei.impuestos?.flujo === 'compra').map(ei => ({
        impuesto_id: ei.impuesto_id, codigo: ei.impuestos.codigo,
        nombre: ei.impuestos.nombre, porcentaje: ei.impuestos.porcentaje,
        monto_calculado: 0, es_automatico: true, cuenta_id: ei.impuestos.cuenta_id || null
      }))
    }
    setItems([...items, {
      bien_servicio_id: bien.id, descripcion: bien.descripcion,
      cantidad: 1, precio_unitario: 0, subtotal_bruto: 0, subtotal_neto: 0,
      bien, impuestos: impuestosAuto, condiciones: [], cuenta_id: cuentaItem
    }])
    setBienSeleccionado('')
  }

  function calcularItem(item: ItemForm): ItemForm {
    const subtotal_bruto = item.cantidad * item.precio_unitario
    let subtotal_neto = subtotal_bruto
    const condiciones = item.condiciones.map(c => {
      let monto = 0
      if (c.forma_calculo === 'porcentual') monto = subtotal_bruto * c.valor / 100
      else if (c.forma_calculo === 'monto_fijo') monto = c.valor
      else if (c.forma_calculo === 'monto_unidad') monto = c.valor * item.cantidad
      if (c.tipo === 'descuento') subtotal_neto -= monto
      else subtotal_neto += monto
      return { ...c, monto_calculado: monto }
    })
    const impuestos = item.impuestos.map(imp => ({
      ...imp, monto_calculado: Math.round(subtotal_neto * imp.porcentaje / 100)
    }))
    return { ...item, subtotal_bruto, subtotal_neto, condiciones, impuestos }
  }

  function actualizarItem(idx: number, campo: string, valor: any) {
    const nuevos = [...items]
    nuevos[idx] = calcularItem({ ...nuevos[idx], [campo]: valor })
    setItems(nuevos)
  }

  function agregarImpuestoItem(idx: number, impuestoId: string) {
    const imp = impuestosDisp.find(i => i.id === impuestoId)
    if (!imp) return
    if (items[idx].impuestos.some(i => i.impuesto_id === impuestoId)) return alert('Ese impuesto ya está en el ítem')
    const nuevos = [...items]
    nuevos[idx] = calcularItem({
      ...nuevos[idx],
      impuestos: [...nuevos[idx].impuestos, {
        impuesto_id: imp.id, codigo: imp.codigo, nombre: imp.nombre,
        porcentaje: imp.porcentaje, monto_calculado: 0, es_automatico: false, cuenta_id: imp.cuenta_id || null
      }]
    })
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
    if (items[idx].condiciones.some(c => c.condicion_precio_id === condId)) return alert('Esa condición ya está en el ítem')
    const cuentaCond = cond.requiere_cuenta ? cond.cuenta_id : items[idx].cuenta_id
    const nuevos = [...items]
    nuevos[idx] = calcularItem({
      ...nuevos[idx],
      condiciones: [...nuevos[idx].condiciones, {
        condicion_precio_id: cond.id, nombre: cond.nombre, abreviatura: cond.abreviatura,
        tipo: cond.tipo, forma_calculo: cond.forma_calculo, valor: 0, monto_calculado: 0,
        requiere_cuenta: cond.requiere_cuenta ?? false, cuenta_id: cuentaCond || null
      }]
    })
    setItems(nuevos)
  }

  function actualizarCondicionItem(idx: number, condId: string, valor: number) {
    const nuevos = [...items]
    nuevos[idx] = calcularItem({
      ...nuevos[idx],
      condiciones: nuevos[idx].condiciones.map(c => c.condicion_precio_id === condId ? { ...c, valor } : c)
    })
    setItems(nuevos)
  }

  function eliminarCondicionItem(idx: number, condId: string) {
    const nuevos = [...items]
    nuevos[idx] = calcularItem({ ...nuevos[idx], condiciones: nuevos[idx].condiciones.filter(c => c.condicion_precio_id !== condId) })
    setItems(nuevos)
  }

  function eliminarItem(idx: number) {
    const item = items[idx]
    if (item.id) setItemsEliminados([...itemsEliminados, item.id])
    setItems(items.filter((_, i) => i !== idx))
  }

  function agregarCondCabecera() {
    if (!condSelCab) return
    const cond = condPrecioDisp.find(c => c.id === condSelCab)
    if (!cond) return
    if (condsCabecera.some(c => c.condicion_precio_id === condSelCab)) return alert('Ya está agregada')
    setCondsCabecera([...condsCabecera, {
      condicion_precio_id: cond.id, nombre: cond.nombre, abreviatura: cond.abreviatura,
      tipo: cond.tipo, forma_calculo: cond.forma_calculo, valor: 0, monto_calculado: 0
    }])
    setCondSelCab('')
  }

  function actualizarCondCabecera(condId: string, valor: number) {
    setCondsCabecera(condsCabecera.map(c => {
      if (c.condicion_precio_id !== condId) return c
      let monto = 0
      if (c.forma_calculo === 'porcentual') monto = totalNeto * valor / 100
      else monto = valor
      return { ...c, valor, monto_calculado: c.tipo === 'descuento' ? -monto : monto }
    }))
  }

  function eliminarCondCabecera(condId: string) {
    setCondsCabecera(condsCabecera.filter(c => c.condicion_precio_id !== condId))
  }

  function agregarImpCabecera() {
    if (!impSelCab) return
    const imp = impuestosDisp.find(i => i.id === impSelCab)
    if (!imp) return
    if (impsCabecera.some(i => i.impuesto_id === impSelCab)) return alert('Ya está agregado')
    const monto = Math.round(totalNeto * imp.porcentaje / 100)
    setImpsCabecera([...impsCabecera, {
      impuesto_id: imp.id, codigo: imp.codigo, nombre: imp.nombre,
      porcentaje: imp.porcentaje, monto_calculado: monto
    }])
    setImpSelCab('')
  }

  function eliminarImpCabecera(impId: string) {
    setImpsCabecera(impsCabecera.filter(i => i.impuesto_id !== impId))
  }

  const totalNeto = items.reduce((sum, i) => sum + i.subtotal_neto, 0)
  const totalCondsCab = condsCabecera.reduce((sum, c) => sum + c.monto_calculado, 0)
  const totalImpItems = items.reduce((sum, i) => sum + i.impuestos.reduce((s, imp) => s + imp.monto_calculado, 0), 0)
  const totalImpCab = impsCabecera.reduce((sum, i) => sum + i.monto_calculado, 0)
  const totalImpuestos = totalImpItems + totalImpCab
  const totalFinal = totalNeto + totalCondsCab + totalImpuestos
  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  async function guardar() {
    if (!cabecera.proveedor_id) return alert('Selecciona un proveedor')
    if (items.length === 0) return alert('Agrega al menos un ítem')
    setGuardando(true)

    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()

    const { error } = await supabase.from('ordenes_compra').update({
      proveedor_id: cabecera.proveedor_id, fecha: cabecera.fecha,
      condicion_pago_id: cabecera.condicion_pago_id || null,
      moneda: cabecera.moneda, observaciones: cabecera.observaciones || null,
      total_neto: totalNeto, total_impuestos: totalImpuestos, total: totalFinal,
      updated_by: user?.email, updated_at: ahora
    }).eq('id', id)

    if (error) { alert('Error: ' + error.message); setGuardando(false); return }

    // Eliminar ítems borrados (cascade elimina sus impuestos y condiciones)
    if (itemsEliminados.length > 0) {
      await supabase.from('ordenes_compra_items').delete().in('id', itemsEliminados)
    }

    // Eliminar condiciones e impuestos de cabecera para reinsertarlos
    await supabase.from('oc_condiciones').delete().eq('orden_compra_id', id as string).is('item_id', null)
    await supabase.from('oc_impuestos').delete().eq('orden_compra_id', id as string).is('item_id', null)

    for (const item of items) {
      if (item.id) {
        // Actualizar ítem existente
        await supabase.from('ordenes_compra_items').update({
          descripcion: item.descripcion, cantidad: item.cantidad,
          precio_unitario: item.precio_unitario, subtotal: item.subtotal_neto,
          cuenta_id: item.cuenta_id, updated_by: user?.email, updated_at: ahora
        }).eq('id', item.id)

        // Eliminar y reinsertar impuestos y condiciones del ítem
        await supabase.from('oc_impuestos').delete().eq('item_id', item.id)
        await supabase.from('oc_condiciones').delete().eq('item_id', item.id)

        if (item.impuestos.length > 0) {
          await supabase.from('oc_impuestos').insert(item.impuestos.map(imp => ({
            orden_compra_id: id, item_id: item.id,
            impuesto_id: imp.impuesto_id, nivel: 'item',
            porcentaje: imp.porcentaje, monto_calculado: imp.monto_calculado,
            es_automatico: imp.es_automatico, cuenta_id: imp.cuenta_id, created_by: user?.email
          })))
        }

        if (item.condiciones.length > 0) {
          await supabase.from('oc_condiciones').insert(item.condiciones.map(c => ({
            orden_compra_id: id, item_id: item.id,
            condicion_precio_id: c.condicion_precio_id, nivel: 'item',
            valor: c.valor, monto_calculado: c.monto_calculado,
            cuenta_id: c.cuenta_id, created_by: user?.email
          })))
        }
      } else {
        // Insertar ítem nuevo
        const { data: itemData } = await supabase.from('ordenes_compra_items').insert([{
          orden_compra_id: id, bien_servicio_id: item.bien_servicio_id,
          descripcion: item.descripcion, cantidad: item.cantidad,
          precio_unitario: item.precio_unitario, subtotal: item.subtotal_neto,
          cantidad_confirmada: 0, documento_abierto: true,
          cuenta_id: item.cuenta_id, created_by: user?.email, updated_by: user?.email, updated_at: ahora
        }]).select()

        if (itemData && itemData[0]) {
          const itemId = itemData[0].id
          if (item.impuestos.length > 0) {
            await supabase.from('oc_impuestos').insert(item.impuestos.map(imp => ({
              orden_compra_id: id, item_id: itemId, impuesto_id: imp.impuesto_id,
              nivel: 'item', porcentaje: imp.porcentaje, monto_calculado: imp.monto_calculado,
              es_automatico: imp.es_automatico, cuenta_id: imp.cuenta_id, created_by: user?.email
            })))
          }
          if (item.condiciones.length > 0) {
            await supabase.from('oc_condiciones').insert(item.condiciones.map(c => ({
              orden_compra_id: id, item_id: itemId, condicion_precio_id: c.condicion_precio_id,
              nivel: 'item', valor: c.valor, monto_calculado: c.monto_calculado,
              cuenta_id: c.cuenta_id, created_by: user?.email
            })))
          }
        }
      }
    }

    // Reinsertar condiciones e impuestos de cabecera
    if (condsCabecera.length > 0) {
      await supabase.from('oc_condiciones').insert(condsCabecera.map(c => ({
        orden_compra_id: id, item_id: null, condicion_precio_id: c.condicion_precio_id,
        nivel: 'cabecera', valor: c.valor, monto_calculado: c.monto_calculado,
        cuenta_id: null, created_by: user?.email
      })))
    }

    if (impsCabecera.length > 0) {
      await supabase.from('oc_impuestos').insert(impsCabecera.map(i => ({
        orden_compra_id: id, item_id: null, impuesto_id: i.impuesto_id,
        nivel: 'cabecera', porcentaje: i.porcentaje, monto_calculado: i.monto_calculado,
        es_automatico: false,
        cuenta_id: impuestosDisp.find(imp => imp.id === i.impuesto_id)?.cuenta_id || null,
        created_by: user?.email
      })))
    }

    router.push(`/compras/${id}`)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/compras/${id}`)} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
          <h1 className="text-2xl font-semibold text-gray-800">Editar Orden de Compra</h1>
        </div>

        {/* CABECERA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Datos generales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Proveedor *</label>
              <select value={cabecera.proveedor_id} onChange={e => setCabecera({ ...cabecera, proveedor_id: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— seleccione proveedor —</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} · {p.rut}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha *</label>
              <input type="date" value={cabecera.fecha} onChange={e => setCabecera({ ...cabecera, fecha: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Condición de pago</label>
              <select value={cabecera.condicion_pago_id} onChange={e => setCabecera({ ...cabecera, condicion_pago_id: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— seleccione —</option>
                {condicionesPago.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Moneda</label>
              <select value={cabecera.moneda} onChange={e => setCabecera({ ...cabecera, moneda: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="UF">UF</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Observaciones</label>
              <input value={cabecera.observaciones} onChange={e => setCabecera({ ...cabecera, observaciones: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        {/* ITEMS */}
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
              {items.map((item, idx) => (
                <div key={idx} className="border border-gray-100 rounded-lg p-4">
                  <div className="grid grid-cols-12 gap-2 items-center mb-3">
                    <div className="col-span-4">
                      <label className="text-xs text-gray-400 block mb-1">Descripción</label>
                      <input value={item.descripcion} onChange={e => actualizarItem(idx, 'descripcion', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                    </div>
                    <div className="col-span-1 text-center">
                      <label className="text-xs text-gray-400 block mb-1">Unidad</label>
                      <span className="text-xs text-gray-500">{item.bien?.unidad || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 block mb-1">Cantidad</label>
                      <input type="number" value={item.cantidad} min="0" step="0.01"
                        onChange={e => actualizarItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 block mb-1">Precio unit.</label>
                      <input type="number" value={item.precio_unitario} min="0"
                        onChange={e => actualizarItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 block mb-1">Subtotal</label>
                      <span className="text-xs font-mono font-medium text-gray-700 block text-right">{fmt(item.subtotal_neto)}</span>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => eliminarItem(idx)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                    </div>
                  </div>

                  {/* Condiciones del ítem */}
                  <div className="mt-2 pl-2 border-l-2 border-amber-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-amber-700 font-medium">Condiciones precio</span>
                      <select onChange={e => { if (e.target.value) { agregarCondicionItem(idx, e.target.value); e.target.value = '' } }}
                        className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white">
                        <option value="">+ agregar</option>
                        {condPrecioDisp.filter(c => c.nivel === 'item' || c.nivel === 'ambos').map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    {item.condiciones.map(c => (
                      <div key={c.condicion_precio_id} className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${c.tipo === 'descuento' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {c.tipo === 'descuento' ? '-' : '+'} {c.abreviatura}
                        </span>
                        <input type="number" value={c.valor} min="0" step="0.01"
                          onChange={e => actualizarCondicionItem(idx, c.condicion_precio_id, parseFloat(e.target.value) || 0)}
                          className="w-20 border border-gray-200 rounded px-2 py-0.5 text-xs text-right" />
                        <span className="text-xs text-gray-400">{c.forma_calculo === 'porcentual' ? '%' : '$'}</span>
                        <span className="text-xs font-mono text-gray-600">{fmt(c.monto_calculado)}</span>
                        <button onClick={() => eliminarCondicionItem(idx, c.condicion_precio_id)} className="text-red-400 text-xs">✕</button>
                      </div>
                    ))}
                  </div>

                  {/* Impuestos del ítem */}
                  <div className="mt-2 pl-2 border-l-2 border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-blue-700 font-medium">Impuestos</span>
                      <select onChange={e => { if (e.target.value) { agregarImpuestoItem(idx, e.target.value); e.target.value = '' } }}
                        className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white">
                        <option value="">+ agregar</option>
                        {impuestosDisp.map(i => (
                          <option key={i.id} value={i.id}>{i.codigo} · {i.nombre}</option>
                        ))}
                      </select>
                    </div>
                    {item.impuestos.map(imp => (
                      <div key={imp.impuesto_id} className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{imp.codigo}</span>
                        <span className="text-xs text-gray-500">{imp.porcentaje}%</span>
                        <span className="text-xs font-mono text-gray-600">{fmt(imp.monto_calculado)}</span>
                        {imp.es_automatico && <span className="text-xs text-gray-400">(auto)</span>}
                        {!imp.es_automatico && <button onClick={() => eliminarImpuestoItem(idx, imp.impuesto_id)} className="text-red-400 text-xs">✕</button>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CONDICIONES CABECERA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Condiciones de precio globales</h2>
          <div className="flex gap-3 mb-3">
            <select value={condSelCab} onChange={e => setCondSelCab(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— seleccione condición —</option>
              {condPrecioDisp.filter(c => c.nivel === 'cabecera' || c.nivel === 'ambos').map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <button onClick={agregarCondCabecera} className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-600">+ Agregar</button>
          </div>
          {condsCabecera.length === 0 ? (
            <p className="text-xs text-gray-400">Sin condiciones globales</p>
          ) : condsCabecera.map(c => (
            <div key={c.condicion_precio_id} className="flex items-center gap-3 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded ${c.tipo === 'descuento' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {c.tipo === 'descuento' ? '-' : '+'} {c.abreviatura}
              </span>
              <input type="number" value={c.valor} min="0" step="0.01"
                onChange={e => actualizarCondCabecera(c.condicion_precio_id, parseFloat(e.target.value) || 0)}
                className="w-24 border border-gray-200 rounded px-2 py-1 text-sm text-right" />
              <span className="text-xs text-gray-400">{c.forma_calculo === 'porcentual' ? '%' : '$'}</span>
              <span className="text-sm font-mono text-gray-600">{fmt(Math.abs(c.monto_calculado))}</span>
              <button onClick={() => eliminarCondCabecera(c.condicion_precio_id)} className="text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>

        {/* IMPUESTOS CABECERA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Impuestos globales</h2>
          <div className="flex gap-3 mb-3">
            <select value={impSelCab} onChange={e => setImpSelCab(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— seleccione impuesto —</option>
              {impuestosDisp.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.nombre} ({i.porcentaje}%)</option>)}
            </select>
            <button onClick={agregarImpCabecera} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600">+ Agregar</button>
          </div>
          {impsCabecera.length === 0 ? (
            <p className="text-xs text-gray-400">Sin impuestos globales</p>
          ) : impsCabecera.map(i => (
            <div key={i.impuesto_id} className="flex items-center gap-3 mb-2">
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">{i.codigo}</span>
              <span className="text-sm text-gray-600">{i.nombre} · {i.porcentaje}%</span>
              <span className="text-sm font-mono text-gray-700">{fmt(i.monto_calculado)}</span>
              <button onClick={() => eliminarImpCabecera(i.impuesto_id)} className="text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>

        {/* TOTALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total neto ítems</span>
                <span className="font-mono">{fmt(totalNeto)}</span>
              </div>
              {condsCabecera.map(c => (
                <div key={c.condicion_precio_id} className="flex justify-between text-gray-500">
                  <span>{c.tipo === 'descuento' ? '-' : '+'} {c.nombre}</span>
                  <span className="font-mono">{fmt(Math.abs(c.monto_calculado))}</span>
                </div>
              ))}
              <div className="flex justify-between text-gray-500">
                <span>Impuestos ítems</span>
                <span className="font-mono">{fmt(totalImpItems)}</span>
              </div>
              {impsCabecera.map(i => (
                <div key={i.impuesto_id} className="flex justify-between text-gray-500">
                  <span>+ {i.nombre}</span>
                  <span className="font-mono">{fmt(i.monto_calculado)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-100 pt-2 text-base">
                <span>Total</span>
                <span className="font-mono">{fmt(totalFinal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ACCIONES */}
        <div className="flex justify-end gap-3">
          <button onClick={() => router.push(`/compras/${id}`)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}