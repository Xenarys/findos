'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/app/context/empresa'

interface Entidad { id: string; razon_social: string; rut: string }

interface ImpuestoPrecargado {
  impuesto_id: string; codigo: string; nombre: string
  porcentaje: number; tipo: string; monto_calculado: number; cuenta_id: string | null
}

interface ConfirmacionItem {
  descripcion: string
  cantidad_confirmada: number
  subtotal_bruto_conf: number
  subtotal_neto_conf: number
  bienes_servicios?: { afecto_iva_compra: boolean; codigo: string; esquema_tributario_compra_id: string | null }
}

interface Confirmacion {
  id: string
  numero_confirmacion: string
  fecha_confirmacion: string
  estado: string
  total_neto: number
  total_iva: number
  orden_compra_id: string
  moneda_oc: string
  ordenes_compra?: { numero: string; moneda: string }
  items: ConfirmacionItem[]
  impuestosEsquema: ImpuestoPrecargado[]
}

interface TasaMoneda { moneda: string; tasa: number; tasaStr: string }

interface ImpuestoExtra {
  impuesto_id: string; codigo: string; nombre: string
  porcentaje: number; tipo: string; monto_calculado: number; cuenta_id: string | null
}

export default function NuevaFacturaC1GPage() {
  const router = useRouter()
  const { empresaActual } = useEmpresa()

  const [proveedores, setProveedores] = useState<Entidad[]>([])
  const [proveedorId, setProveedorId] = useState('')
  const [confirmacionesDisp, setConfirmacionesDisp] = useState<Confirmacion[]>([])
  const [confirmacionesSeleccionadas, setConfirmacionesSeleccionadas] = useState<Confirmacion[]>([])
  const [busquedaConf, setBusquedaConf] = useState('')
  const [impuestosDisp, setImpuestosDisp] = useState<any[]>([])
  const [impuestosExtra, setImpuestosExtra] = useState<ImpuestoExtra[]>([])
  const [tasasMoneda, setTasasMoneda] = useState<TasaMoneda[]>([])
  const [esquemaCache, setEsquemaCache] = useState<Record<string, any[]>>({})

  const [folio, setFolio] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [monedaPago, setMonedaPago] = useState('CLP')
  const [observaciones, setObservaciones] = useState('')
  const [netoReal, setNetoReal] = useState<string>('')
  const [ivaReal, setIvaReal] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargarInicial() }, [])
  useEffect(() => { if (proveedorId) cargarConfirmaciones() }, [proveedorId])

  async function cargarInicial() {
    const [provs, imps] = await Promise.all([
      supabase.from('entidades').select('id, razon_social, rut').eq('tipo_proveedor', true).eq('activo', true).order('razon_social'),
      supabase.from('impuestos').select('id, codigo, nombre, porcentaje, tipo, flujo, cuenta_id').eq('activo', true).eq('flujo', 'compra').order('codigo')
    ])
    if (provs.data) setProveedores(provs.data)
    if (imps.data) setImpuestosDisp(imps.data)
  }

  async function cargarEsquemaImpuestos(esquemaId: string): Promise<any[]> {
    if (esquemaCache[esquemaId]) return esquemaCache[esquemaId]
    const { data } = await supabase
      .from('esquema_impuestos')
      .select('impuesto_id, impuestos(id, codigo, nombre, porcentaje, tipo, flujo, cuenta_id)')
      .eq('esquema_id', esquemaId)
    const resultado = (data || []).filter((ei: any) =>
      ei.impuestos?.flujo === 'compra' && ei.impuestos?.tipo !== 'iva'
    ) as any[]
    setEsquemaCache(prev => ({ ...prev, [esquemaId]: resultado }))
    return resultado
  }

  async function cargarConfirmaciones() {
    setLoading(true)
    setConfirmacionesDisp([])
    setConfirmacionesSeleccionadas([])

    // 1. Obtener OCs del proveedor
    const { data: ocs } = await supabase.from('ordenes_compra')
      .select('id, numero, moneda').eq('proveedor_id', proveedorId)
    if (!ocs || ocs.length === 0) { setLoading(false); return }

    const ocIds = ocs.map(o => o.id)

    // 2. Obtener confirmaciones pending_factura
    const { data: confs } = await supabase
      .from('oc_confirmaciones')
      .select('*, ordenes_compra(numero, moneda)')
      .in('orden_compra_id', ocIds)
      .eq('estado', 'pending_factura')
      .order('fecha_confirmacion', { ascending: false })

    if (!confs || confs.length === 0) { setLoading(false); return }

    // 3. FIX BUG 1/3/6: Excluir confirmaciones ya en facturas no anuladas
    const confIds = confs.map(c => c.id)
    const { data: facConfs } = await supabase
      .from('factura_confirmaciones')
      .select('confirmacion_id, facturas(estado)')
      .in('confirmacion_id', confIds)

    const confIdsYaFacturados = new Set(
      (facConfs || [])
        .filter((fc: any) => fc.facturas?.estado !== 'anulada')
        .map((fc: any) => fc.confirmacion_id)
    )

    const confsDisponibles = confs.filter(c => !confIdsYaFacturados.has(c.id))

    // 4. Cargar detalle de cada confirmación
    const confsConDetalle = await Promise.all(confsDisponibles.map(async (conf: any) => {
      // FIX BUG 2: descripcion viene de ordenes_compra_items, no de oc_confirmaciones_items
      const { data: items } = await supabase
        .from('oc_confirmaciones_items')
        .select(`
          cantidad_confirmada, subtotal_bruto_conf, subtotal_neto_conf,
          ordenes_compra_items(
            descripcion,
            bienes_servicios(afecto_iva_compra, codigo, esquema_tributario_compra_id)
          )
        `)
        .eq('confirmacion_id', conf.id)

      const totalNeto = items?.reduce((sum, i) => sum + i.subtotal_neto_conf, 0) || 0

      // Calcular IVA propuesto de ítems afectos
      let totalIva = 0
      const impuestosEsquemaConf: ImpuestoPrecargado[] = []

      if (items) {
        for (const item of items) {
          const bs = (item as any).ordenes_compra_items?.bienes_servicios
          const afecto = bs?.afecto_iva_compra
          const fechaConf = conf.fecha_confirmacion?.split('T')[0] || fecha

          if (afecto) {
            const { data: ivaData } = await supabase
              .from('impuestos').select('porcentaje')
              .eq('tipo', 'iva').eq('flujo', 'compra').eq('activo', true)
              .lte('fecha_desde', fechaConf)
              .or(`fecha_hasta.is.null,fecha_hasta.gte.${fechaConf}`)
              .limit(1)
            if (ivaData && ivaData.length > 0) {
              totalIva += Math.round(item.subtotal_neto_conf * ivaData[0].porcentaje / 100)
            }
          }

          // FIX BUG 5: Cargar impuestos adicionales del esquema tributario
          if (bs?.esquema_tributario_compra_id) {
            const esqImps = await cargarEsquemaImpuestos(bs.esquema_tributario_compra_id)
            for (const ei of esqImps) {
              const monto = Math.round(item.subtotal_neto_conf * ei.impuestos.porcentaje / 100)
              const existing = impuestosEsquemaConf.find(i => i.impuesto_id === ei.impuesto_id)
              if (existing) {
                existing.monto_calculado += monto
              } else {
                impuestosEsquemaConf.push({
                  impuesto_id: ei.impuesto_id,
                  codigo: ei.impuestos.codigo,
                  nombre: ei.impuestos.nombre,
                  porcentaje: ei.impuestos.porcentaje,
                  tipo: ei.impuestos.tipo,
                  monto_calculado: monto,
                  cuenta_id: ei.impuestos.cuenta_id || null
                })
              }
            }
          }
        }
      }

      return {
        ...conf,
        total_neto: totalNeto,
        total_iva: totalIva,
        moneda_oc: conf.ordenes_compra?.moneda || 'CLP',
        impuestosEsquema: impuestosEsquemaConf,
        items: (items || []).map((i: any) => ({
          descripcion: i.ordenes_compra_items?.descripcion || '—',
          cantidad_confirmada: i.cantidad_confirmada,
          subtotal_bruto_conf: i.subtotal_bruto_conf,
          subtotal_neto_conf: i.subtotal_neto_conf,
          bienes_servicios: i.ordenes_compra_items?.bienes_servicios
        }))
      }
    }))

    setConfirmacionesDisp(confsConDetalle)
    setLoading(false)
  }

  function agregarConfirmacion(conf: Confirmacion) {
    if (confirmacionesSeleccionadas.some(c => c.id === conf.id)) return
    const nuevas = [...confirmacionesSeleccionadas, conf]
    setConfirmacionesSeleccionadas(nuevas)
    const monedasNecesarias = new Set(nuevas.map(c => c.moneda_oc).filter(m => m !== 'CLP'))
    setTasasMoneda(prev => {
      const nuevasTasas = [...prev]
      monedasNecesarias.forEach(m => {
        if (!nuevasTasas.some(t => t.moneda === m)) nuevasTasas.push({ moneda: m, tasa: 0, tasaStr: '' })
      })
      return nuevasTasas.filter(t => monedasNecesarias.has(t.moneda))
    })
  }

  function quitarConfirmacion(confId: string) {
    const nuevas = confirmacionesSeleccionadas.filter(c => c.id !== confId)
    setConfirmacionesSeleccionadas(nuevas)
    const monedasNecesarias = new Set(nuevas.map(c => c.moneda_oc).filter(m => m !== 'CLP'))
    setTasasMoneda(prev => prev.filter(t => monedasNecesarias.has(t.moneda)))
  }

  function actualizarTasa(moneda: string, valor: string) {
    setTasasMoneda(prev => prev.map(t => t.moneda === moneda ? { ...t, tasaStr: valor, tasa: parseFloat(valor) || 0 } : t))
  }

  function getTasa(moneda: string): number {
    if (moneda === 'CLP') return 1
    return tasasMoneda.find(t => t.moneda === moneda)?.tasa || 0
  }

  function convertirACLP(monto: number, moneda: string): number {
    if (moneda === 'CLP') return monto
    const tasa = getTasa(moneda)
    return tasa > 0 ? monto * tasa : 0
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  // Totales propuestos
  const netoPropuesto = confirmacionesSeleccionadas.reduce((sum, c) => sum + convertirACLP(c.total_neto, c.moneda_oc), 0)
  const ivaPropuesto = confirmacionesSeleccionadas.reduce((sum, c) => sum + convertirACLP(c.total_iva, c.moneda_oc), 0)

  // Impuestos precargados del esquema (agregados de todas las confirmaciones seleccionadas)
  const impPrecargadosAgrupados = Object.values(
    confirmacionesSeleccionadas.flatMap(c => c.impuestosEsquema || []).reduce((acc: any, imp) => {
      if (!acc[imp.impuesto_id]) acc[imp.impuesto_id] = { ...imp, monto_calculado: 0 }
      acc[imp.impuesto_id].monto_calculado += imp.monto_calculado
      return acc
    }, {})
  ) as ImpuestoPrecargado[]
  const impPrecargadosTotal = impPrecargadosAgrupados.reduce((sum, i) => sum + i.monto_calculado, 0)

  const impExtrasTotal = impuestosExtra.reduce((sum, i) => sum + i.monto_calculado, 0)
  const totalPropuesto = netoPropuesto + ivaPropuesto + impPrecargadosTotal + impExtrasTotal

  const netoRealNum = parseFloat(netoReal) || 0
  const ivaRealNum = parseFloat(ivaReal) || 0
  const totalReal = netoRealNum + ivaRealNum + impPrecargadosTotal + impExtrasTotal
  const diferenciaNeto = netoRealNum > 0 ? netoRealNum - netoPropuesto : 0
  const diferenciaIva = ivaRealNum > 0 ? ivaRealNum - ivaPropuesto : 0

  function agregarImpuestoExtra(impId: string) {
    const imp = impuestosDisp.find(i => i.id === impId)
    if (!imp) return
    if (impuestosExtra.some(i => i.impuesto_id === impId)) return alert('Ya está agregado')
    const base = netoRealNum > 0 ? netoRealNum : netoPropuesto
    const monto = Math.round(base * imp.porcentaje / 100)
    setImpuestosExtra([...impuestosExtra, {
      impuesto_id: imp.id, codigo: imp.codigo, nombre: imp.nombre,
      porcentaje: imp.porcentaje, tipo: imp.tipo, monto_calculado: monto, cuenta_id: imp.cuenta_id || null
    }])
  }

  function eliminarImpuestoExtra(impId: string) {
    setImpuestosExtra(impuestosExtra.filter(i => i.impuesto_id !== impId))
  }

  const confsFiltradas = confirmacionesDisp.filter(c =>
    !confirmacionesSeleccionadas.some(s => s.id === c.id) &&
    (busquedaConf === '' ||
      c.numero_confirmacion.toLowerCase().includes(busquedaConf.toLowerCase()) ||
      (c.ordenes_compra?.numero || '').toLowerCase().includes(busquedaConf.toLowerCase()))
  )

  const tasasFaltantes = tasasMoneda.some(t => t.tasa <= 0)

  // FIX BUG 4: Generar número interno de factura
  async function generarNumeroFactura(): Promise<string> {
    const { data } = await supabase
      .from('facturas').select('numero')
      .like('numero', 'FC-%')
      .order('numero', { ascending: false })
      .limit(1)
    if (data && data.length > 0 && data[0].numero) {
      const ultimo = parseInt(data[0].numero.split('-')[1] || '0')
      return `FC-${String(ultimo + 1).padStart(8, '0')}`
    }
    return 'FC-00000001'
  }

  async function guardar(emitir: boolean) {
    if (!proveedorId) return alert('Selecciona un proveedor')
    if (confirmacionesSeleccionadas.length === 0) return alert('Selecciona al menos una confirmación')
    if (emitir && !folio.trim()) return alert('El número de folio es obligatorio para emitir')
    if (tasasFaltantes) return alert('Ingresa las tasas de cambio para todas las monedas')
    setGuardando(true)

    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()

    const netoFinal = netoRealNum > 0 ? netoRealNum : netoPropuesto
    const ivaFinal = ivaRealNum > 0 ? ivaRealNum : ivaPropuesto
    const totalFinal = netoFinal + ivaFinal + impPrecargadosTotal + impExtrasTotal
    const numero = await generarNumeroFactura()

    const { data: facturaData, error } = await supabase.from('facturas').insert([{
      numero,
      numero_folio: folio.trim() || null,
      tipo: 'C1G', flujo: 'compra',
      entidad_id: proveedorId, fecha, moneda: monedaPago,
      estado: emitir ? 'emitida' : 'borrador',
      observaciones: observaciones || null,
      neto_propuesto: netoPropuesto,
      neto_real: netoFinal,
      iva_propuesto: ivaPropuesto,
      iva_real: ivaFinal,
      imp_adicionales_propuesto: impPrecargadosTotal + impExtrasTotal,
      imp_adicionales_real: impPrecargadosTotal + impExtrasTotal,
      diferencia_neto: diferenciaNeto,
      diferencia_iva: diferenciaIva,
      total_propuesto: totalPropuesto,
      total_real: totalFinal,
      total_neto: netoFinal,
      total_impuestos: ivaFinal + impPrecargadosTotal + impExtrasTotal,
      total: totalFinal,
      empresa_id: empresaActual!.id,
      created_by: user?.email, updated_by: user?.email, updated_at: ahora
    }]).select()

    if (error || !facturaData) { alert('Error: ' + error?.message); setGuardando(false); return }
    const factura_id = facturaData[0].id

    // Vincular confirmaciones
    await supabase.from('factura_confirmaciones').insert(
      confirmacionesSeleccionadas.map(c => ({
        factura_id, confirmacion_id: c.id, tipo_flujo: 'compra', subtotal_neto: c.total_neto
      }))
    )

    // Guardar impuestos precargados del esquema tributario (es_automatico: true)
    if (impPrecargadosAgrupados.length > 0) {
      await supabase.from('factura_impuestos').insert(impPrecargadosAgrupados.map(imp => ({
        factura_id, item_id: null, impuesto_id: imp.impuesto_id,
        nivel: 'cabecera', porcentaje: imp.porcentaje, monto_calculado: imp.monto_calculado,
        es_automatico: true, cuenta_id: imp.cuenta_id, created_by: user?.email
      })))
    }

    // Guardar impuestos adicionales manuales (es_automatico: false)
    if (impuestosExtra.length > 0) {
      await supabase.from('factura_impuestos').insert(impuestosExtra.map(imp => ({
        factura_id, item_id: null, impuesto_id: imp.impuesto_id,
        nivel: 'cabecera', porcentaje: imp.porcentaje, monto_calculado: imp.monto_calculado,
        es_automatico: false, cuenta_id: imp.cuenta_id, created_by: user?.email
      })))
    }

    // Marcar confirmaciones como facturadas solo al emitir
    if (emitir) {
      await supabase.from('oc_confirmaciones')
        .update({ estado: 'facturada', updated_at: ahora })
        .in('id', confirmacionesSeleccionadas.map(c => c.id))
    }

    setGuardando(false)
    router.push(`/facturas/${factura_id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/facturas')} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
          <h1 className="text-2xl font-semibold text-gray-800">Nueva Factura de Compra (C1G)</h1>
        </div>

        {/* DATOS GENERALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Datos generales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Proveedor *</label>
              <select value={proveedorId} onChange={e => { setProveedorId(e.target.value); setConfirmacionesSeleccionadas([]) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— seleccione proveedor —</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} · {p.rut}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                N° Folio / Factura {!folio && <span className="text-orange-500">(requerido para emitir)</span>}
              </label>
              <input value={folio} onChange={e => setFolio(e.target.value)} placeholder="Ej: 123456"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Moneda de pago</label>
              <select value={monedaPago} onChange={e => setMonedaPago(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="UF">UF</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Observaciones</label>
              <input value={observaciones} onChange={e => setObservaciones(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        {/* TASAS DE CAMBIO */}
        {tasasMoneda.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 mb-4">
            <h2 className="text-sm font-semibold text-amber-700 mb-3 uppercase tracking-wide">Tasas de conversión a CLP</h2>
            <div className="grid grid-cols-2 gap-4">
              {tasasMoneda.map(t => (
                <div key={t.moneda}>
                  <label className="text-xs text-amber-700 mb-1 block">1 {t.moneda} = ? CLP *</label>
                  <input type="number" step="0.000001" min="0" value={t.tasaStr}
                    onChange={e => actualizarTasa(t.moneda, e.target.value)}
                    placeholder="Ej: 950.25"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONFIRMACIONES DISPONIBLES */}
        {proveedorId && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Confirmaciones disponibles</h2>
            <input type="text" placeholder="Buscar por N° confirmación u OC..."
              value={busquedaConf} onChange={e => setBusquedaConf(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" />
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
            ) : confsFiltradas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin confirmaciones pendientes</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {confsFiltradas.map(conf => (
                  <div key={conf.id} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-mono text-blue-600 font-medium">{conf.numero_confirmacion}</span>
                        <span className="text-xs text-gray-500 ml-2">OC: {conf.ordenes_compra?.numero}</span>
                        <span className="text-xs font-medium ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{conf.moneda_oc}</span>
                      </div>
                      <button onClick={() => agregarConfirmacion(conf)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                        + Agregar
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {conf.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="truncate max-w-xs">{item.descripcion} × {item.cantidad_confirmada}</span>
                          <span className="font-mono ml-2">{fmt(item.subtotal_neto_conf)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-medium text-gray-700 border-t border-gray-100 pt-1 mt-1">
                        <span>Neto confirmación</span>
                        <span className="font-mono">{fmt(conf.total_neto)}</span>
                      </div>
                      {conf.total_iva > 0 && (
                        <div className="flex justify-between text-blue-600">
                          <span>IVA propuesto</span>
                          <span className="font-mono">{fmt(conf.total_iva)}</span>
                        </div>
                      )}
                      {conf.impuestosEsquema.length > 0 && conf.impuestosEsquema.map(imp => (
                        <div key={imp.impuesto_id} className="flex justify-between text-orange-600">
                          <span>{imp.nombre} {imp.porcentaje}% (esquema)</span>
                          <span className="font-mono">{fmt(imp.monto_calculado)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONFIRMACIONES SELECCIONADAS + AJUSTES */}
        {confirmacionesSeleccionadas.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Confirmaciones a facturar</h2>
            <div className="space-y-2 mb-6">
              {confirmacionesSeleccionadas.map(conf => (
                <div key={conf.id} className="border border-blue-100 rounded-lg px-3 py-2 bg-blue-50">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-xs font-mono text-blue-600 font-medium">{conf.numero_confirmacion}</span>
                      <span className="text-xs text-gray-500 ml-2">OC: {conf.ordenes_compra?.numero}</span>
                      <span className="text-xs font-medium ml-2 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{conf.moneda_oc}</span>
                    </div>
                    <button onClick={() => quitarConfirmacion(conf.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                  <div className="text-xs text-gray-600 flex gap-4 flex-wrap">
                    <span>Neto: <span className="font-mono font-medium">{fmt(conf.total_neto)}</span></span>
                    {conf.total_iva > 0 && <span className="text-blue-600">IVA: <span className="font-mono font-medium">{fmt(conf.total_iva)}</span></span>}
                    {conf.impuestosEsquema.map(imp => (
                      <span key={imp.impuesto_id} className="text-orange-600">{imp.codigo}: <span className="font-mono font-medium">{fmt(imp.monto_calculado)}</span></span>
                    ))}
                    {conf.moneda_oc !== 'CLP' && getTasa(conf.moneda_oc) > 0 && (
                      <span className="text-amber-600">→ CLP: <span className="font-mono font-medium">{fmt(convertirACLP(conf.total_neto, conf.moneda_oc))}</span></span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* IMPUESTOS PRECARGADOS DEL ESQUEMA (informativos, no editables) */}
            {impPrecargadosAgrupados.length > 0 && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-lg">
                <p className="text-xs text-orange-700 font-medium mb-2">Impuestos precargados (esquema tributario)</p>
                {impPrecargadosAgrupados.map(imp => (
                  <div key={imp.impuesto_id} className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">{imp.codigo}</span>
                    <span className="text-xs text-gray-500">{imp.nombre} · {imp.porcentaje}%</span>
                    <span className="text-xs font-mono text-gray-700 ml-auto">{fmt(imp.monto_calculado)}</span>
                    <span className="text-xs text-gray-400">(auto)</span>
                  </div>
                ))}
              </div>
            )}

            {/* IMP. ADICIONALES DE ÚLTIMO MINUTO */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-orange-700 font-medium">Imp. / Condiciones adicionales de último minuto</span>
                <select onChange={e => { if (e.target.value) { agregarImpuestoExtra(e.target.value); e.target.value = '' } }}
                  className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white">
                  <option value="">+ agregar impuesto</option>
                  {impuestosDisp.filter(i => i.tipo !== 'iva').map(i => (
                    <option key={i.id} value={i.id}>{i.codigo} · {i.nombre} ({i.porcentaje}%)</option>
                  ))}
                </select>
              </div>
              {impuestosExtra.map(imp => (
                <div key={imp.impuesto_id} className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700">{imp.codigo}</span>
                  <span className="text-xs text-gray-500">{imp.porcentaje}%</span>
                  <span className="text-xs font-mono text-gray-600">{fmt(imp.monto_calculado)}</span>
                  <button onClick={() => eliminarImpuestoExtra(imp.impuesto_id)} className="text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>

            {/* CUADRO PROPUESTO VS REAL */}
            <div className="border-t border-gray-100 pt-4">
              <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                <div></div>
                <div className="text-center text-xs font-medium text-gray-500 uppercase">Propuesto</div>
                <div className="text-center text-xs font-medium text-gray-500 uppercase">Real (factura física)</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm mb-2 items-center">
                <div className="text-gray-600">Neto</div>
                <div className="text-right font-mono text-gray-700">{fmt(netoPropuesto)}</div>
                <div>
                  <input type="number" step="1" min="0" value={netoReal}
                    onChange={e => setNetoReal(e.target.value)}
                    placeholder={fmt(netoPropuesto)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm mb-2 items-center">
                <div className="text-blue-600">IVA</div>
                <div className="text-right font-mono text-blue-600">{fmt(ivaPropuesto)}</div>
                <div>
                  <input type="number" step="1" min="0" value={ivaReal}
                    onChange={e => setIvaReal(e.target.value)}
                    placeholder={fmt(ivaPropuesto)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                </div>
              </div>
              {impPrecargadosTotal > 0 && (
                <div className="grid grid-cols-3 gap-4 text-sm mb-2 items-center">
                  <div className="text-orange-600">Imp. Esquema (auto)</div>
                  <div className="text-right font-mono text-orange-600">{fmt(impPrecargadosTotal)}</div>
                  <div className="text-right font-mono text-orange-500 text-xs pr-2">{fmt(impPrecargadosTotal)}</div>
                </div>
              )}
              {impExtrasTotal > 0 && (
                <div className="grid grid-cols-3 gap-4 text-sm mb-2 items-center">
                  <div className="text-red-600">Imp. Adicionales</div>
                  <div className="text-right font-mono text-red-600">{fmt(impExtrasTotal)}</div>
                  <div className="text-right font-mono text-red-600 text-xs pr-2">{fmt(impExtrasTotal)}</div>
                </div>
              )}
              {(diferenciaNeto !== 0 || diferenciaIva !== 0) && (
                <div className="grid grid-cols-3 gap-4 text-sm mb-2 items-center bg-yellow-50 rounded p-2">
                  <div className="text-yellow-700 font-medium">Diferencias</div>
                  <div></div>
                  <div className="text-right font-mono text-yellow-700">{fmt(diferenciaNeto + diferenciaIva)}</div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 text-sm border-t border-gray-100 pt-2 mt-2 items-center">
                <div className="font-semibold text-gray-800">Total</div>
                <div className="text-right font-mono font-semibold text-gray-800">{fmt(totalPropuesto)}</div>
                <div className="text-right font-mono font-semibold text-gray-800">{fmt(totalReal > 0 ? totalReal : totalPropuesto)}</div>
              </div>
            </div>
          </div>
        )}

        {/* ACCIONES */}
        <div className="flex justify-end gap-3">
          <button onClick={() => router.push('/facturas')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Cancelar</button>
          <button onClick={() => guardar(false)} disabled={guardando || tasasFaltantes}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button onClick={() => guardar(true)} disabled={guardando || !folio.trim() || tasasFaltantes}
            className="px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {guardando ? 'Emitiendo...' : 'Emitir factura'}
          </button>
        </div>
      </div>
    </div>
  )
}
