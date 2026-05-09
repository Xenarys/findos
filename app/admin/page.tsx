'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ItemLista {
  id: string
  nombre: string
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

export default function AdminPage() {
  const [tabActiva, setTabActiva] = useState('empresas')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])
  const [monedas, setMonedas] = useState<ItemLista[]>([])
  const [condiciones, setCondiciones] = useState<ItemLista[]>([])
  const [clasificaciones, setClasificaciones] = useState<ItemLista[]>([])
  const [unidades, setUnidades] = useState<ItemLista[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoItem, setEditandoItem] = useState<any>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formBanco, setFormBanco] = useState({ codigo_sbif: '', codigo_swift: '', tipo: 'nacional', activo: true })
  const [formEmpresa, setFormEmpresa] = useState({
    nombre: '', nombre_comercial: '', rut: '',
    direccion: '', ciudad: '', giro: '', email: '', telefono: '',
    activo: true
  })

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const [emp, ban, mon, con, cla, uni] = await Promise.all([
      supabase.from('empresas').select('*').order('nombre'),
      supabase.from('bancos').select('*').order('nombre'),
      supabase.from('monedas').select('*').order('nombre'),
      supabase.from('condiciones_pago').select('*').order('nombre'),
      supabase.from('clasificaciones').select('*').order('nombre'),
      supabase.from('unidades').select('*').order('nombre'),
    ])
    if (emp.data) setEmpresas(emp.data)
    if (ban.data) setBancos(ban.data)
    if (mon.data) setMonedas(mon.data)
    if (con.data) setCondiciones(con.data)
    if (cla.data) setClasificaciones(cla.data)
    if (uni.data) setUnidades(uni.data)
    setLoading(false)
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

  async function guardarBanco() {
    if (!formNombre) return alert('El nombre es obligatorio')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      await supabase.from('bancos').update({
        nombre: formNombre, ...formBanco,
        updated_by: user?.email, updated_at: ahora
      }).eq('id', editandoItem.id)
    } else {
      await supabase.from('bancos').insert([{
        nombre: formNombre, ...formBanco,
        created_by: user?.email, updated_by: user?.email, updated_at: ahora
      }])
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
    setFormEmpresa({ nombre: '', nombre_comercial: '', rut: '', direccion: '', ciudad: '', giro: '', email: '', telefono: '', activo: true })
    setMostrarForm(true)
  }

  function abrirEditar(item: any) {
    setEditandoItem(item)
    if (tabActiva === 'empresas') {
      setFormEmpresa({
        nombre: item.nombre || '',
        nombre_comercial: item.nombre_comercial || '',
        rut: item.rut || '',
        direccion: item.direccion || '',
        ciudad: item.ciudad || '',
        giro: item.giro || '',
        email: item.email || '',
        telefono: item.telefono || '',
        activo: item.activo ?? true
      })
    } else if (tabActiva === 'bancos') {
      setFormNombre(item.nombre)
      setFormBanco({
        codigo_sbif: item.codigo_sbif || '',
        codigo_swift: item.codigo_swift || '',
        tipo: item.tipo || 'nacional',
        activo: item.activo ?? true
      })
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
  ]

  const tablaMap: any = {
    monedas: { data: monedas, tabla: 'monedas' },
    condiciones: { data: condiciones, tabla: 'condiciones_pago' },
    clasificaciones: { data: clasificaciones, tabla: 'clasificaciones' },
    unidades: { data: unidades, tabla: 'unidades' },
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Administración</h1>
          <p className="text-sm text-gray-500">Tablas de configuración del sistema</p>
        </div>

        <div className="flex gap-1 mb-6 bg-white border border-gray-100 rounded-xl p-1 w-fit">
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
            <button onClick={abrirNuevo}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              + Nuevo
            </button>
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-8">Cargando...</div>
          ) : tabActiva === 'empresas' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Nombre', 'Nombre comercial', 'RUT', 'Ciudad', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empresas.map(e => (
                  <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{e.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{e.nombre_comercial || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.rut}</td>
                    <td className="px-4 py-3 text-gray-600">{e.ciudad || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${e.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {e.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => abrirEditar(e)}
                        className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50 transition-colors">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tabActiva === 'bancos' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Nombre', 'Cód. SBIF', 'SWIFT', 'Tipo', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bancos.map(b => (
                  <tr key={b.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{b.nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.codigo_sbif || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.codigo_swift || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{b.tipo || 'nacional'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${b.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {b.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => abrirEditar(b)}
                        className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50 transition-colors">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Nombre', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tablaMap[tabActiva]?.data.map((item: ItemLista) => (
                  <tr key={item.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{item.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {item.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => abrirEditar(item)}
                        className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50 transition-colors">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* FORMULARIO */}
        {mostrarForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  {editandoItem ? 'Editar' : 'Nuevo'} {tabs.find(t => t.id === tabActiva)?.label.slice(0, -1)}
                </h2>
                <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }}
                  className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {tabActiva === 'empresas' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                    <input value={formEmpresa.nombre} onChange={e => setFormEmpresa({ ...formEmpresa, nombre: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Nombre comercial</label>
                    <input value={formEmpresa.nombre_comercial} onChange={e => setFormEmpresa({ ...formEmpresa, nombre_comercial: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">RUT *</label>
                    <input value={formEmpresa.rut} onChange={e => setFormEmpresa({ ...formEmpresa, rut: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Ciudad</label>
                    <input value={formEmpresa.ciudad} onChange={e => setFormEmpresa({ ...formEmpresa, ciudad: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Giro</label>
                    <input value={formEmpresa.giro} onChange={e => setFormEmpresa({ ...formEmpresa, giro: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Dirección</label>
                    <input value={formEmpresa.direccion} onChange={e => setFormEmpresa({ ...formEmpresa, direccion: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Email</label>
                    <input value={formEmpresa.email} onChange={e => setFormEmpresa({ ...formEmpresa, email: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
                    <input value={formEmpresa.telefono} onChange={e => setFormEmpresa({ ...formEmpresa, telefono: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox"
                        checked={formEmpresa.activo}
                        onChange={e => setFormEmpresa({ ...formEmpresa, activo: e.target.checked })} />
                      Empresa activa
                    </label>
                  </div>
                  <div className="col-span-2 flex justify-end gap-3 mt-2">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }}
                      className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarEmpresa}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {editandoItem ? 'Actualizar' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : tabActiva === 'bancos' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                    <input value={formNombre} onChange={e => setFormNombre(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Código SBIF</label>
                    <input value={formBanco.codigo_sbif} onChange={e => setFormBanco({ ...formBanco, codigo_sbif: e.target.value })}
                      placeholder="Ej: 001"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Código SWIFT</label>
                    <input value={formBanco.codigo_swift} onChange={e => setFormBanco({ ...formBanco, codigo_swift: e.target.value })}
                      placeholder="Ej: BCHICLRM"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                 <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" value="nacional" checked={formBanco.tipo === 'nacional'}
                          onChange={e => setFormBanco({ ...formBanco, tipo: e.target.value })} />
                        Nacional
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" value="extranjero" checked={formBanco.tipo === 'extranjero'}
                          onChange={e => setFormBanco({ ...formBanco, tipo: e.target.value })} />
                        Extranjero
                      </label>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox"
                        checked={formBanco.activo}
                        onChange={e => setFormBanco({ ...formBanco, activo: e.target.checked })} />
                      Banco activo
                    </label>
                  </div>
                  <div className="col-span-2 flex justify-end gap-3 mt-2">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }}
                      className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={guardarBanco}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {editandoItem ? 'Actualizar' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                  <input value={formNombre} onChange={e => setFormNombre(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setMostrarForm(false); setEditandoItem(null) }}
                      className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={() => guardarItem(tablaMap[tabActiva].tabla)}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {editandoItem ? 'Actualizar' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}