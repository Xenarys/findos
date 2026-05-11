'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ItemLista {
  id: string
  nombre: string
  activo: boolean
}

interface Unidad {
  id: string
  nombre: string
  abreviatura: string
  es_monto_global: boolean
  activo: boolean
}

interface Condicion {
  id: string
  nombre: string
  dias: number
  activo: boolean
}

interface Moneda {
  id: string
  nombre: string
  codigo: string
  activo: boolean
}

interface Banco {
  id: string
  nombre: string
  codigo_sbif: string
  codigo_swift: string
  tipo: string
  activo: boolean
}

interface Empresa {
  id: string
  nombre: string
  nombre_comercial: string
  rut: string
  direccion: string
  ciudad: string
  giro: string
  email: string
  telefono: string
  activo: boolean
}

interface Operacion {
  id: string
  codigo: string
  nombre: string
  tipo: string
  es_inventario: boolean
  activo: boolean
}

interface CuentaPC {
  id: string
  codigo: string
  nombre: string
}

interface ClasifCuenta {
  id: string
  clasificacion_id: string
  operacion_id: string
  cuenta_id: string
  operaciones_contables?: { codigo: string; nombre: string }
  plan_cuentas?: { codigo: string; nombre: string }
}

export default function AdminPage() {
  const [tabActiva, setTabActiva] = useState('empresas')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [condiciones, setCondiciones] = useState<Condicion[]>([])
  const [clasificaciones, setClasificaciones] = useState<ItemLista[]>([])
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [operaciones, setOperaciones] = useState<Operacion[]>([])
  const [cuentasPC, setCuentasPC] = useState<CuentaPC[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoItem, setEditandoItem] = useState<any>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formBanco, setFormBanco] = useState({ codigo_sbif: '', codigo_swift: '', tipo: 'nacional', activo: true })
  const [formMoneda, setFormMoneda] = useState({ codigo: '', activo: true })
  const [formCondicion, setFormCondicion] = useState({ dias: 0, activo: true })
  const [formUnidad, setFormUnidad] = useState({ abreviatura: '', es_monto_global: false, activo: true })
  const [formOperacion, setFormOperacion] = useState({ codigo: '', tipo: 'compra', es_inventario: false, activo: true })
  const [formEmpresa, setFormEmpresa] = useState({
    nombre: '', nombre_comercial: '', rut: '',
    direccion: '', ciudad: '', giro: '', email: '', telefono: '',
    activo: true
  })

  // Clasificaciones con cuentas
  const [clasificacionSeleccionada, setClasificacionSeleccionada] = useState<ItemLista | null>(null)
  const [clasifCuentas, setClasifCuentas] = useState<ClasifCuenta[]>([])
  const [modalClasifCuentas, setModalClasifCuentas] = useState(false)
  const [formClasifCuenta, setFormClasifCuenta] = useState({ operacion_id: '', cuenta_id: '' })
  const [editandoClasifCuenta, setEditandoClasifCuenta] = useState<ClasifCuenta | null>(null)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const [emp, ban, mon, con, cla, uni, ope, cpc] = await Promise.all([
      supabase.from('empresas').select('*').order('nombre'),
      supabase.from('bancos').select('*').order('nombre'),
      supabase.from('monedas').select('*').order('nombre'),
      supabase.from('condiciones_pago').select('*').order('dias'),
      supabase.from('clasificaciones').select('*').order('nombre'),
      supabase.from('unidades').select('*').order('nombre'),
      supabase.from('operaciones_contables').select('*').order('codigo'),
      supabase.from('plan_cuentas').select('id, codigo, nombre').eq('activo', true).order('codigo'),
    ])
    if (emp.data) setEmpresas(emp.data)
    if (ban.data) setBancos(ban.data)
    if (mon.data) setMonedas(mon.data)
    if (con.data) setCondiciones(con.data)
    if (cla.data) setClasificaciones(cla.data)
    if (uni.data) setUnidades(uni.data)
    if (ope.data) setOperaciones(ope.data)
    if (cpc.data) setCuentasPC(cpc.data)
    setLoading(false)
  }

  async function abrirClasifCuentas(clas: ItemLista) {
    setClasificacionSeleccionada(clas)
    const { data } = await supabase
      .from('clasificacion_cuentas')
      .select('*, operaciones_contables(codigo, nombre), plan_cuentas(codigo, nombre)')
      .eq('clasificacion_id', clas.id)
    if (data) setClasifCuentas(data)
    setModalClasifCuentas(true)
    setFormClasifCuenta({ operacion_id: '', cuenta_id: '' })
    setEditandoClasifCuenta(null)
  }

  async function guardarClasifCuenta() {
    if (!formClasifCuenta.operacion_id || !formClasifCuenta.cuenta_id) return alert('Operación y cuenta son obligatorios')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()

    if (editandoClasifCuenta) {
      const { error } = await supabase.from('clasificacion_cuentas').update({
        operacion_id: formClasifCuenta.operacion_id,
        cuenta_id: formClasifCuenta.cuenta_id,
        updated_by: user?.email, updated_at: ahora
      }).eq('id', editandoClasifCuenta.id)
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe esa operación en esta clasificación' : error.message))
    } else {
      const { error } = await supabase.from('clasificacion_cuentas').insert([{
        clasificacion_id: clasificacionSeleccionada!.id,
        operacion_id: formClasifCuenta.operacion_id,
        cuenta_id: formClasifCuenta.cuenta_id,
        created_by: user?.email, updated_by: user?.email, updated_at: ahora
      }])
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe esa operación en esta clasificación' : error.message))
    }
    setFormClasifCuenta({ operacion_id: '', cuenta_id: '' })
    setEditandoClasifCuenta(null)
    if (clasificacionSeleccionada) abrirClasifCuentas(clasificacionSeleccionada)
  }

  async function eliminarClasifCuenta(id: string) {
    if (!confirm('¿Eliminar esta asignación?')) return
    await supabase.from('clasificacion_cuentas').delete().eq('id', id)
    if (clasificacionSeleccionada) abrirClasifCuentas(clasificacionSeleccionada)
  }

  async function guardarItem(tabla: string) {
    if (!formNombre) return alert('El nombre es obligatorio')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      await supabase.from(tabla).update({ nombre: formNombre, updated_by: user?.email, updated_at: ahora }).eq('id', editandoItem.id)
    } else {
      await supabase.from(tabla).insert([{ nombre: formNombre, created_by: user?.email, updated_by: user?.email, updated_at: ahora }])
    }
    setMostrarForm(false)
    setEditandoItem(null)
    setFormNombre('')
    cargarTodo()
  }

  async function guardarOperacion() {
    if (!formNombre || !formOperacion.codigo) return alert('Código y nombre son obligatorios')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      const { error } = await supabase.from('operaciones_contables').update({
        nombre: formNombre, ...formOperacion,
        updated_by: user?.email, updated_at: ahora
      }).eq('id', editandoItem.id)
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe una operación con ese código' : error.message))
    } else {
      const { error } = await supabase.from('operaciones_contables').insert([{
        nombre: formNombre, ...formOperacion,
        created_by: user?.email, updated_by: user?.email, updated_at: ahora
      }])
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe una operación con ese código' : error.message))
    }
    setMostrarForm(false)
    setEditandoItem(null)
    setFormNombre('')
    setFormOperacion({ codigo: '', tipo: 'compra', es_inventario: false, activo: true })
    cargarTodo()
  }

  async function guardarUnidad() {
    if (!formNombre) return alert('El nombre es obligatorio')
    if (!formUnidad.abreviatura) return alert('La abreviatura es obligatoria')
    if (formUnidad.abreviatura.length > 4) return alert('La abreviatura no puede tener más de 4 caracteres')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      await supabase.from('unidades').update({ nombre: formNombre, ...formUnidad, updated_by: user?.email, updated_at: ahora }).eq('id', editandoItem.id)
    } else {
      await supabase.from('unidades').insert([{ nombre: formNombre, ...formUnidad, created_by: user?.email, updated_by: user?.email, updated_at: ahora }])
    }
    setMostrarForm(false)
    setEditandoItem(null)
    setFormNombre('')
    setFormUnidad({ abreviatura: '', es_monto_global: false, activo: true })
    cargarTodo()
  }

  async function guardarCondicion() {
    if (!formNombre) return alert('El nombre es obligatorio')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      await supabase.from('condiciones_pago').update({ nombre: formNombre, ...formCondicion, updated_by: user?.email, updated_at: ahora }).eq('id', editandoItem.id)
    } else {
      await supabase.from('condiciones_pago').insert([{ nombre: formNombre, ...formCondicion, created_by: user?.email, updated_by: user?.email, updated_at: ahora }])
    }
    setMostrarForm(false)
    setEditandoItem(null)
    setFormNombre('')
    setFormCondicion({ dias: 0, activo: true })
    cargarTodo()
  }

  async function guardarMoneda() {
    if (!formNombre) return alert('El nombre es obligatorio')
    if (!formMoneda.codigo) return alert('El código es obligatorio')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      await supabase.from('monedas').update({ nombre: formNombre, ...formMoneda, updated_by: user?.email, updated_at: ahora }).eq('id', editandoItem.id)
    } else {
      await supabase.from('monedas').insert([{ nombre: formNombre, ...formMoneda, created_by: user?.email, updated_by: user?.email, updated_at: ahora }])
    }
    setMostrarForm(false)
    setEditandoItem(null)
    setFormNombre('')
    setFormMoneda({ codigo: '', activo: true })
    cargarTodo()
  }

  async function guardarBanco() {
    if (!formNombre) return alert('El nombre es obligatorio')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      await supabase.from('bancos').update({ nombre: formNombre, ...formBanco, updated_by: user?.email, updated_at: ahora }).eq('id', editandoItem.id)
    } else {
      await supabase.from('bancos').insert([{ nombre: formNombre, ...formBanco, created_by: user?.email, updated_by: user?.email, updated_at: ahora }])
    }
    setMostrarForm(false)
    setEditandoItem(null)
    setFormNombre('')
    setFormBanco({ codigo_sbif: '', codigo_swift: '', tipo: 'nacional', activo: true })
    cargarTodo()
  }

  async function guardarEmpresa() {
    if (!formEmpresa.nombre || !formEmpresa.rut) return alert('Nombre y RUT son obligatorios')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      await supabase.from('empresas').update({ ...formEmpresa, updated_by: user?.email, updated_at: ahora }).eq('id', editandoItem.id)
    } else {
      await supabase.from('empresas').insert([{ ...formEmpresa, created_by: user?.email, updated_by: user?.email, updated_at: ahora }])
    }
    setMostrarForm(false)
    setEditandoItem(null)
    setFormEmpresa({ nombre: '', nombre_comercial: '', rut: '', direccion: '', ciudad: '', giro: '', email: '', telefono: '', activo: true })
    cargarTodo()
  }

  function abrirNuevo() {
    setEditandoItem(null)
    setFormNombre('')
    setFormBanco({ codigo_sbif: '', codigo_swift: '', tipo: 'nacional', activo: true })
    setFormMoneda({ codigo: '', activo: true })
    setFormCondicion({ dias: 0, activo: true })
    setFormUnidad({ abreviatura: '', es_monto_global: false, activo: true })
    setFormOperacion({ codigo: '', tipo: 'compra', es_inventario: false, activo: true })
    setFormEmpresa({ nombre: '', nombre_comercial: '', rut: '', direccion: '', ciudad: '', giro: '', email: '', telefono: '', activo: true })
    setMostrarForm(true)
  }

  function abrirEditar(item: any) {
    setEditandoItem(item)
    if (tabActiva === 'empresas') {
      setFormEmpresa({
        nombre: item.nombre || '', nombre_comercial: item.nombre_comercial || '',
        rut: item.rut || '', direccion: item.direccion || '', ciudad: item.ciudad || '',
        giro: item.giro || '', email: item.email || '', telefono: item.telefono || '',
        activo: item.activo ?? true
      })
    } else if (tabActiva === 'bancos') {
      setFormNombre(item.nombre)
      setFormBanco({ codigo_sbif: item.codigo_sbif || '', codigo_swift: item.codigo_swift || '', tipo: item.tipo || 'nacional', activo: item.activo ?? true })
    } else if (tabActiva === 'monedas') {
      setFormNombre(item.nombre)
      setFormMoneda({ codigo: item.codigo || '', activo: item.activo ?? true })
    } else if (tabActiva === 'condiciones') {
      setFormNombre(item.nombre)
      setFormCondicion({ dias: item.dias || 0, activo: item.activo ?? true })
    } else if (tabActiva === 'unidades') {
      setFormNombre(item.nombre)
      setFormUnidad({ abreviatura: item.abreviatura || '', es_monto_global: item.es_monto_global ?? false, activo: item.activo ?? true })
    } else if (tabActiva === 'operaciones') {
      setFormNombre(item.nombre)
      setFormOperacion({ codigo: item.codigo || '', tipo: item.tipo || 'compra', es_inventario: item.es_inventario ?? false, activo: item.activo ?? true })
    } else {
      setFormNombre(item.nombre)
    }
    setMostrarForm(true)
  }

  const tabs = [
    { id: 'empresas', label: 'Empresas' },
    { id: 'bancos', label: 'Bancos' },
    { id: 'monedas', label: 'Monedas' },
    { id: 'condiciones', label: 'Condiciones de pago' },
    { id: 'clasificaciones', label: 'Clasificaciones' },
    { id: 'unidades', label: 'Unidades' },
    { id: 'operaciones', label: 'Operaciones contables' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Administración</h1>
          <p className="text-sm text-gray-500">Tablas de configuración del sistema</p>
        </div>

        <div className="flex gap-1 mb-6 bg-white border border-gray-100 rounded-xl p-1 flex-wrap">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setTabActiva(tab.id); setMostrarForm(false) }}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${tabActiva === tab.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-medium text-gray-700">
              {tabs.find(t => t.id === tabActiva)?.label}
            </h2>
            {tabActiva !== 'clasificaciones' && (
              <button onClick={abrirNuevo}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                + Nuevo
              </button>
            )}
            {tabActiva === 'clasificaciones' && (
              <button onClick={() => { setEditandoItem(null); setFormNombre(''); setMostrarForm(true) }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                + Nueva
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-8">Cargando...</div>
          ) : tabActiva === 'empresas' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Nombre', 'Nombre comercial', 'RUT', 'Ciudad', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {empresas.map(e => (
                  <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{e.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{e.nombre_comercial || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.rut}</td>
                    <td className="px-4 py-3 text-gray-600">{e.ciudad || '—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${e.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{e.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="px-4 py-3"><button onClick={() => abrirEditar(e)} className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tabActiva === 'bancos' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Nombre', 'Cód. SBIF', 'SWIFT', 'Tipo', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {bancos.map(b => (
                  <tr key={b.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{b.nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.codigo_sbif || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.codigo_swift || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{b.tipo || 'nacional'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${b.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{b.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="px-4 py-3"><button onClick={() => abrirEditar(b)} className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tabActiva === 'monedas' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Nombre', 'Código', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {monedas.map(m => (
                  <tr key={m.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{m.nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.codigo || '—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${m.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{m.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="px-4 py-3"><button onClick={() => abrirEditar(m)} className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tabActiva === 'condiciones' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Nombre', 'Días', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {condiciones.map(c => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{c.dias} días</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${c.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="px-4 py-3"><button onClick={() => abrirEditar(c)} className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tabActiva === 'unidades' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Nombre', 'Abrev.', 'Tipo gestión', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {unidades.map(u => (
                  <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{u.nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{u.abreviatura || '—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.es_monto_global ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>{u.es_monto_global ? 'Monto global' : 'Uni/Valor'}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="px-4 py-3"><button onClick={() => abrirEditar(u)} className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tabActiva === 'operaciones' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Código', 'Nombre', 'Tipo', 'Inventario', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {operaciones.map(o => (
                  <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{o.codigo}</td>
                    <td className="px-4 py-3 font-medium">{o.nombre}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${o.tipo === 'compra' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{o.tipo === 'compra' ? 'Compra' : 'Venta'}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${o.es_inventario ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-500'}`}>{o.es_inventario ? 'Inventario' : 'Gasto'}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${o.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{o.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="px-4 py-3"><button onClick={() => abrirEditar(o)} className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tabActiva === 'clasificaciones' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Nombre', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {clasificaciones.map(c => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.nombre}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${c.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => abrirEditar(c)} className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">Editar</button>
                        <button onClick={() => abrirClasifCuentas(c)} className="text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50">Cuentas</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        {/* FORMULARIO PRINCIPAL */}
        {mostrarForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  {editandoItem ? 'Editar' : 'Nuevo'} {tabs.find(t => t.id === tabActiva)?.label.slice(0, -1)}
                </h2>
                <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {tabActiva === 'empresas' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Nombre *</label><input value={formEmpresa.nombre} onChange={e => setFormEmpresa({ ...formEmpresa, nombre: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Nombre comercial</label><input value={formEmpresa.nombre_comercial} onChange={e => setFormEmpresa({ ...formEmpresa, nombre_comercial: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">RUT *</label><input value={formEmpresa.rut} onChange={e => setFormEmpresa({ ...formEmpresa, rut: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Ciudad</label><input value={formEmpresa.ciudad} onChange={e => setFormEmpresa({ ...formEmpresa, ciudad: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Giro</label><input value={formEmpresa.giro} onChange={e => setFormEmpresa({ ...formEmpresa, giro: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Dirección</label><input value={formEmpresa.direccion} onChange={e => setFormEmpresa({ ...formEmpresa, direccion: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Email</label><input value={formEmpresa.email} onChange={e => setFormEmpresa({ ...formEmpresa, email: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Teléfono</label><input value={formEmpresa.telefono} onChange={e => setFormEmpresa({ ...formEmpresa, telefono: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="col-span-2"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={formEmpresa.activo} onChange={e => setFormEmpresa({ ...formEmpresa, activo: e.target.checked })} />Empresa activa</label></div>
                  <div className="col-span-2 flex justify-end gap-3 mt-2">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarEmpresa} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editandoItem ? 'Actualizar' : 'Guardar'}</button>
                  </div>
                </div>
              ) : tabActiva === 'bancos' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Nombre *</label><input value={formNombre} onChange={e => setFormNombre(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Código SBIF</label><input value={formBanco.codigo_sbif} onChange={e => setFormBanco({ ...formBanco, codigo_sbif: e.target.value })} placeholder="Ej: 001" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Código SWIFT</label><input value={formBanco.codigo_swift} onChange={e => setFormBanco({ ...formBanco, codigo_swift: e.target.value })} placeholder="Ej: BCHICLRM" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="nacional" checked={formBanco.tipo === 'nacional'} onChange={e => setFormBanco({ ...formBanco, tipo: e.target.value })} />Nacional</label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="extranjero" checked={formBanco.tipo === 'extranjero'} onChange={e => setFormBanco({ ...formBanco, tipo: e.target.value })} />Extranjero</label>
                    </div>
                  </div>
                  <div className="col-span-2"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={formBanco.activo} onChange={e => setFormBanco({ ...formBanco, activo: e.target.checked })} />Banco activo</label></div>
                  <div className="col-span-2 flex justify-end gap-3 mt-2">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarBanco} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editandoItem ? 'Actualizar' : 'Guardar'}</button>
                  </div>
                </div>
              ) : tabActiva === 'monedas' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Nombre *</label><input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: Peso Chileno" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Código *</label><input value={formMoneda.codigo} onChange={e => setFormMoneda({ ...formMoneda, codigo: e.target.value })} placeholder="Ej: CLP" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={formMoneda.activo} onChange={e => setFormMoneda({ ...formMoneda, activo: e.target.checked })} />Moneda activa</label></div>
                  <div className="col-span-2 flex justify-end gap-3 mt-2">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarMoneda} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editandoItem ? 'Actualizar' : 'Guardar'}</button>
                  </div>
                </div>
              ) : tabActiva === 'condiciones' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Nombre *</label><input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: 30 días" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Días *</label><input type="number" value={formCondicion.dias} onChange={e => setFormCondicion({ ...formCondicion, dias: parseInt(e.target.value) || 0 })} placeholder="Ej: 30" min="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={formCondicion.activo} onChange={e => setFormCondicion({ ...formCondicion, activo: e.target.checked })} />Condición activa</label></div>
                  <div className="col-span-2 flex justify-end gap-3 mt-2">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarCondicion} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editandoItem ? 'Actualizar' : 'Guardar'}</button>
                  </div>
                </div>
              ) : tabActiva === 'unidades' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Nombre *</label><input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: Hora" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Abreviatura * (máx. 4 caracteres)</label><input value={formUnidad.abreviatura} onChange={e => setFormUnidad({ ...formUnidad, abreviatura: e.target.value.slice(0, 4) })} placeholder="Ej: hr" maxLength={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" /></div>
                  <div className="col-span-2"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={formUnidad.es_monto_global} onChange={e => setFormUnidad({ ...formUnidad, es_monto_global: e.target.checked })} />Gestión por monto global (no por cantidad)</label><p className="text-xs text-gray-400 mt-1 ml-6">Usar para servicios que se confirman por valor en vez de unidades</p></div>
                  <div className="col-span-2"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={formUnidad.activo} onChange={e => setFormUnidad({ ...formUnidad, activo: e.target.checked })} />Unidad activa</label></div>
                  <div className="col-span-2 flex justify-end gap-3 mt-2">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarUnidad} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editandoItem ? 'Actualizar' : 'Guardar'}</button>
                  </div>
                </div>
              ) : tabActiva === 'operaciones' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Código * (ej: C1G)</label><input value={formOperacion.codigo} onChange={e => setFormOperacion({ ...formOperacion, codigo: e.target.value.toUpperCase() })} placeholder="Ej: C1G" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Nombre *</label><input value={formNombre} onChange={e => setFormNombre(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="compra" checked={formOperacion.tipo === 'compra'} onChange={e => setFormOperacion({ ...formOperacion, tipo: e.target.value })} />Compra</label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" value="venta" checked={formOperacion.tipo === 'venta'} onChange={e => setFormOperacion({ ...formOperacion, tipo: e.target.value })} />Venta</label>
                    </div>
                  </div>
                  <div className="col-span-2"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={formOperacion.es_inventario} onChange={e => setFormOperacion({ ...formOperacion, es_inventario: e.target.checked })} />Es operación de inventario</label></div>
                  <div className="col-span-2"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={formOperacion.activo} onChange={e => setFormOperacion({ ...formOperacion, activo: e.target.checked })} />Operación activa</label></div>
                  <div className="col-span-2 flex justify-end gap-3 mt-2">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarOperacion} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editandoItem ? 'Actualizar' : 'Guardar'}</button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                  <input value={formNombre} onChange={e => setFormNombre(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={() => guardarItem('clasificaciones')} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editandoItem ? 'Actualizar' : 'Guardar'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL CUENTAS POR CLASIFICACION */}
        {modalClasifCuentas && clasificacionSeleccionada && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Cuentas contables</h2>
                  <p className="text-sm text-gray-500">{clasificacionSeleccionada.nombre}</p>
                </div>
                <button onClick={() => { setModalClasifCuentas(false); setClasificacionSeleccionada(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {/* Formulario agregar/editar */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-xs font-medium text-gray-500 mb-3">{editandoClasifCuenta ? 'Editar asignación' : 'Agregar operación + cuenta'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Operación *</label>
                    <select value={formClasifCuenta.operacion_id} onChange={e => setFormClasifCuenta({ ...formClasifCuenta, operacion_id: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">— seleccione —</option>
                      {operaciones.filter(o => o.activo).map(o => (
                        <option key={o.id} value={o.id}>{o.codigo} · {o.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Cuenta *</label>
                    <select value={formClasifCuenta.cuenta_id} onChange={e => setFormClasifCuenta({ ...formClasifCuenta, cuenta_id: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">— seleccione —</option>
                      {cuentasPC.map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  {editandoClasifCuenta && (
                    <button onClick={() => { setEditandoClasifCuenta(null); setFormClasifCuenta({ operacion_id: '', cuenta_id: '' }) }}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                  )}
                  <button onClick={guardarClasifCuenta}
                    className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    {editandoClasifCuenta ? 'Actualizar' : 'Agregar'}
                  </button>
                </div>
              </div>

              {/* Lista de asignaciones */}
              {clasifCuentas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No hay cuentas asignadas aún</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Operación', 'Cuenta', ''].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clasifCuentas.map(cc => (
                      <tr key={cc.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs font-bold text-blue-600">{cc.operaciones_contables?.codigo}</span>
                          <span className="text-xs text-gray-500 ml-2">{cc.operaciones_contables?.nombre}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs text-emerald-700">{cc.plan_cuentas?.codigo}</span>
                          <span className="text-xs text-gray-600 ml-2">{cc.plan_cuentas?.nombre}</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <button onClick={() => {
                              setEditandoClasifCuenta(cc)
                              setFormClasifCuenta({ operacion_id: cc.operacion_id, cuenta_id: cc.cuenta_id })
                            }} className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full hover:bg-gray-50">Editar</button>
                            <button onClick={() => eliminarClasifCuenta(cc.id)}
                              className="text-xs text-red-400 border border-red-200 px-2 py-0.5 rounded-full hover:bg-red-50">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}