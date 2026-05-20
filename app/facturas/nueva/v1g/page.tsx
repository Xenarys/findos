'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/app/context/empresa'

interface Entidad { id: string; razon_social: string; rut: string }

interface ConfirmacionItem {
  descripcion: string
  cantidad_confirmada: number
  subtotal_bruto_conf: number
  subtotal_neto_conf: number
  bienes_servicios?: { afecto_iva_venta: boolean; codigo: string }
}

interface Confirmacion {
  id: string
  numero_confirmacion: string
  fecha_confirmacion: string
  estado: string
  hes: string
  total_neto: number
  total_iva: number
  pedido_venta_id: string
  moneda_pv: string
  pedidos_venta?: { numero: string; moneda: string }
  items: ConfirmacionItem[]
}

interface TasaMoneda {
  moneda: string
  tasa: number
  tasaStr: string
}

interface ImpuestoExtra {
  impuesto_id: string
  codigo: string
  nombre: string
  porcentaje: number
  tipo: string
  monto_calculado: number
  cuenta_id: string | null
}

export default function NuevaFacturaV1GPage() {
  const router = useRouter()
  const { empresaActual } = useEmpresa()

  const [clientes, setClientes] = useState<Entidad[]>([])
  const [clienteId, setClienteId] = useState('')
  const [confirmacionesDisp, setConfirmacionesDisp] = useState<Confirmacion[]>([])
  const [confirmacionesSeleccionadas, setConfirmacionesSeleccionadas] = useState<Confirmacion[]>([])
  const [busquedaConf, setBusquedaConf] = useState('')
  const [impuestosDisp, setImpuestosDisp] = useState<any[]>([])
  const [impuestosExtra, setImpuestosExtra] = useState<ImpuestoExtra[]>([])
  const [tasasMoneda, setTasasMoneda] = useState<TasaMoneda[]>([])

  const [folio, setFolio] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [monedaPago, setMonedaPago] = useState('CLP')
  const [observaciones, setObservaciones] = useState('')

  const [netoReal, setNetoReal] = useState<string>('')
  const [ivaReal, setIvaReal] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargarInicial() }, [])
  useEffect(() => { if (clienteId) cargarConfirmaciones() }, [clienteId])

  async function cargarInicial() {
    const { data: clts } = await supabase.from('entidades').select('id, razon_social, rut').eq('tipo_cliente', true).eq('activo', true).order('razon_social')
    if (clts) setClientes(clts)
    const { data: imps } = await supabase.from('impuestos').select('id, codigo, nombre, porcentaje, tipo, flujo, cuenta_id').eq('activo', true).eq('flujo', 'venta').order('codigo')
    if (imps) setImpuestosDisp(imps)
  }

  async function cargarConfirmaciones() {
    setLoading(true)
    setConfirmacionesDisp([])
    setConfirmacionesSeleccionadas([])

    const { data: pvs } = await supabase.from('pedidos_venta').select('id, numero, moneda').eq('cliente_id', clienteId)
    if (!pvs || pvs.length === 0) { setLoading(false); return }

    const pvIds = pvs.map(p => p.id)
    const { data: confs } = await supabase
      .from('pv_confirmaciones')
      .select('*, pedidos_venta(numero, moneda)')
      .in('pedido_venta_id', pvIds)
      .eq('estado', 'pending_factura')
      .order('fecha_confirmacion', { ascending: false })

    if (confs) {
      const confsConDetalle = await Promise.all(confs.map(async (conf: any) => {
        const { data: items } = await supabase
          .from('pv_confirmaciones_items')
          .select('descripcion, cantidad_confirmada, subtotal_bruto_conf, subtotal_neto_conf, pedidos_venta_items(bienes_servicios(afecto_iva_venta, codigo))')
          .eq('confirmacion_id', conf.id)

        const totalNeto = items?.reduce((sum, i) => sum + i.subtotal_neto_conf, 0) || 0

        let totalIva = 0
        if (items) {
          for (const item of items) {
            const afecto = (item as any).pedidos_venta_items?.bienes_servicios?.afecto_iva_venta
            if (afecto) {
              const { data: ivaData } = await supabase
                .from('impuestos')
                .select('porcentaje')
                .eq('tipo', 'iva')
                .eq('flujo', 'venta')
                .eq('activo', true)
                .lte('fecha_desde', conf.fecha_confirmacion?.split('T')[0] || fecha)
                .or(`fecha_hasta.is.null,fecha_hasta.gte.${conf.fecha_confirmacion?.split('T')[0] || fecha}`)
                .limit(1)
              if (ivaData && ivaData.length > 0) {
                totalIva += Math.round(item.subtotal_neto_conf * ivaData[0].porcentaje / 100)
              }
            }
          }
        }

        return {
          ...conf,
          total_neto: totalNeto,
          total_iva: totalIva,
          moneda_pv: conf.pedidos_venta?.moneda || 'CLP',
          items: (items || []).map((i: any) => ({
            descripcion: i.descripcion,
            cantidad_confirmada: i.cantidad_confirmada,
            subtotal_bruto_conf: i.subtotal_bruto_conf,
            subtotal_neto_conf: i.subtotal_neto_conf,
            bienes_servicios: i.pedidos_venta_items?.bienes_servicios
          }))
        }
      }))
      setConfirmacionesDisp(confsConDetalle)
    }
    setLoading(false)
  }

  function agregarConfirmacion(conf: Confirmacion) {
    if (confirmacionesSeleccionadas.some(c => c.id === conf.id)) return
    const nuevas = [...confirmacionesSeleccionadas, conf]
    setConfirmacionesSeleccionadas(nuevas)
    const monedasNecesarias = new Set(nuevas.map(c => c.moneda_pv).filter(m => m !== 'CLP'))
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
    const monedasNecesarias = new Set(nuevas.map(c => c.moneda_pv).filter(m => m !== 'CLP'))
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

  const netoPropuesto = confirmacionesSeleccionadas.reduce((sum, c) => sum + convertirACLP(c.total_neto, c.moneda_pv), 0)
  const ivaPropuesto = confirmacionesSeleccionadas.reduce((sum, c) => sum + convertirACLP(c.total_iva, c.moneda_pv), 0)
  const impExtrasTotal = impuestosExtra.reduce((sum, i) => sum + i.monto_calculado, 0)
  const totalPropuesto = netoPropuesto + ivaPropuesto + impExtrasTotal

  const netoRealNum = parseFloat(netoReal) || 0
  const ivaRealNum = parseFloat(ivaReal) || 0
  const totalReal = netoRealNum + ivaRealNum + impExtrasTotal
  const diferenciaNeto = netoRealNum > 0 ? netoRealNum - netoPropuesto : 0
  const diferenciaIva = ivaRealNum > 0 ? ivaRealNum - ivaPropuesto : 0

  function agregarImpuestoExtra(impId: string) {
    const imp = impuestosDisp.find(i => i.id === impId)
    if (!imp) return
    if (impuestosExtra.some(i => i.impuesto_id === impId)) return alert('Ya está agregado')
    const base = netoRealNum > 0 ? netoRealNum : netoPropuesto
    const monto = Math.round(base * imp.porcentaje / 100)
    setImpuestosExtra([...impuestosExtra, { impuesto_id: imp.id, codigo: imp.codigo, nombre: imp.nombre, porcentaje: imp.porcentaje, tipo: imp.tipo, monto_calculado: monto, cuenta_id: imp.cuenta_id || null }])
  }

  function eliminarImpuestoExtra(impId: string) {
    setImpuestosExtra(impuestosExtra.filter(i => i.impuesto_id !== impId))
  }

  const confsFiltradas = confirmacionesDisp.filter(c =>
    !confirmacionesSeleccionadas.some(s => s.id === c.id) &&
    (busquedaConf === '' ||
      c.numero_confirmacion.toLowerCase().includes(busquedaConf.toLowerCase()) ||
      (c.pedidos_venta?.numero || '').toLowerCase().includes(busquedaConf.toLowerCase()) ||
      c.hes.toLowerCase().includes(busquedaConf.toLowerCase()))
  )

  const tasasFaltantes = tasasMoneda.some(t => t.tasa <= 0)

  async function guardar(emitir: boolean) {
    if (!clienteId) return alert('Selecciona un cliente')
    if (confirmacionesSeleccionadas.length === 0) return alert('Selecciona al menos una confirmación')
    if (emitir && !folio.trim()) return alert('El número de folio es obligatorio para emitir')
    if (tasasFaltantes) return alert('Ingresa las tasas de cambio para todas las monedas')
    setGuardando(true)

    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()

    const netoFinal = netoRealNum > 0 ? netoRealNum : netoPropuesto
    const ivaFinal = ivaRealNum > 0 ? ivaRealNum : ivaPropuesto
    const totalFinal = netoFinal + ivaFinal + impExtrasTotal

    const { data: facturaData, error } = await supabase.from('facturas').insert([{
      numero_folio: folio.trim() || null,
      tipo: 'V1G', flujo: 'venta',
      entidad_id: clienteId, fecha, moneda: monedaPago,
      estado: emitir ? 'emitida' : 'borrador',
      observaciones: observaciones || null,
      neto_propuesto: netoPropuesto,
      neto_real: netoRealNum > 0 ? netoRealNum : netoPropuesto,
      iva_propuesto: ivaPropuesto,
      iva_real: ivaRealNum > 0 ? ivaRealNum : ivaPropuesto,
      imp_adicionales_propuesto: impExtrasTotal,
      imp_adicionales_real: impExtrasTotal,
      diferencia_neto: diferenciaNeto,
      diferencia_iva: diferenciaIva,
      total_propuesto: totalPropuesto,
      total_real: totalFinal,
      total_neto: netoFinal,
      total_impuestos: ivaFinal + impExtrasTotal,
      total: totalFinal,
      empresa_id: empresaActual!.id,
      created_by: user?.email, updated_by: user?.email, updated_at: ahora
    }]).select()

    if (error || !facturaData) { alert('Error: ' + error?.message); setGuardando(false); return }
    const factura_id = facturaData[0].id

    await supabase.from('factura_confirmaciones').insert(
      confirmacionesSeleccionadas.map(c => ({
        factura_id, confirmacion_id: c.id, tipo_flujo: 'venta', subtotal_neto: c.total_neto
      }))
    )

    if (impuestosExtra.length > 0) {
      await supabase.from('factura_impuestos').insert(impuestosExtra.map(imp => ({
        factura_id, item_id: null, impuesto_id: imp.impuesto_id,
        nivel: 'cabecera', porcentaje: imp.porcentaje, monto_calculado: imp.monto_calculado,
        es_automatico: false, cuenta_id: imp.cuenta_id, created_by: user?.email
      })))
    }

    if (emitir) {
      await supabase.from('pv_confirmaciones')
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
          <h1 className="text-2xl font-semibold text-gray-800">Nueva Factura de Venta (V1G)</h1>
        </div>

        {/* DATOS GENERALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Datos generales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Cliente *</label>
              <select value={clienteId} onChange={e => { setClienteId(e.target.value); setConfirmacionesSeleccionadas([]) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— seleccione cliente —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social} · {c.rut}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">N° Folio / Factura {!folio && <span className="text-orange-500">(requerido para emitir)</span>}</label>
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
                  <input type="number" step="0.000001" min="0"
                    value={t.tasaStr}
                    onChange={e => actualizarTasa(t.moneda, e.target.value)}
                    placeholder="Ej: 950.25"
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONFIRMACIONES DISPONIBLES */}
        {clienteId && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Confirmaciones disponibles</h2>
            <input type="text" placeholder="Buscar por N° confirmación, PV o HES..."
              value={busquedaConf} onChange={e => setBusquedaConf(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-blue-300" />
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
                        <span className="text-xs text-gray-500 ml-2">PV: {conf.pedidos_venta?.numero}</span>
                        <span className="text-xs font-medium ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{conf.moneda_pv}</span>
                        <span className="text-xs text-green-600 ml-2">HES: {conf.hes}</span>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONFIRMACIONES SELECCIONADAS + TOTALES */}
        {confirmacionesSeleccionadas.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Confirmaciones a facturar</h2>
            <div className="space-y-2 mb-6">
              {confirmacionesSeleccionadas.map(conf => (
                <div key={conf.id} className="border border-green-100 rounded-lg px-3 py-2 bg-green-50">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-xs font-mono text-blue-600 font-medium">{conf.numero_confirmacion}</span>
                      <span className="text-xs text-gray-500 ml-2">PV: {conf.pedidos_venta?.numero}</span>
                      <span className="text-xs font-medium ml-2 px-1.5 py-0.5 rounded bg-green-100 text-green-700">{conf.moneda_pv}</span>
                      <span className="text-xs text-green-600 ml-2">HES: {conf.hes}</span>
                    </div>
                    <button onClick={() => quitarConfirmacion(conf.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                  <div className="text-xs text-gray-600 flex gap-4">
                    <span>Neto: <span className="font-mono font-medium">{fmt(conf.total_neto)}</span></span>
                    {conf.total_iva > 0 && <span className="text-blue-600">IVA: <span className="font-mono font-medium">{fmt(conf.total_iva)}</span></span>}
                    {conf.moneda_pv !== 'CLP' && getTasa(conf.moneda_pv) > 0 && (
                      <span className="text-amber-600">→ CLP: <span className="font-mono font-medium">{fmt(convertirACLP(conf.total_neto, conf.moneda_pv))}</span></span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* IMP. ADICIONALES */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-orange-700 font-medium">Imp. / Retenciones adicionales</span>
                <select onChange={e => { if (e.target.value) { agregarImpuestoExtra(e.target.value); e.target.value = '' } }}
                  className="text-xs border border-gray-200 rounded px-2 py-0.5 bg-white">
                  <option value="">+ agregar</option>
                  {impuestosDisp.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.nombre} ({i.porcentaje}%)</option>)}
                </select>
              </div>
              {impuestosExtra.map(imp => (
                <div key={imp.impuesto_id} className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-700">{imp.codigo}</span>
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
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-300" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm mb-2 items-center">
                <div className="text-blue-600">IVA</div>
                <div className="text-right font-mono text-blue-600">{fmt(ivaPropuesto)}</div>
                <div>
                  <input type="number" step="1" min="0" value={ivaReal}
                    onChange={e => setIvaReal(e.target.value)}
                    placeholder={fmt(ivaPropuesto)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-300" />
                </div>
              </div>
              {impExtrasTotal > 0 && (
                <div className="grid grid-cols-3 gap-4 text-sm mb-2 items-center">
                  <div className="text-orange-600">Imp. Adicionales</div>
                  <div className="text-right font-mono text-orange-600">{fmt(impExtrasTotal)}</div>
                  <div className="text-right font-mono text-orange-600 text-xs pr-2">{fmt(impExtrasTotal)}</div>
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