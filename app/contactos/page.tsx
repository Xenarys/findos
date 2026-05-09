'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Contacto {
  id: string
  nombre: string
  cargo: string
  email: string
  telefono: string
  es_principal: boolean
  entidad_id: string
  entidades?: { razon_social: string; nombre_comercial: string }
}

interface Entidad {
  id: string
  razon_social: string
  nombre_comercial: string
}

const formInicial = {
  nombre: '', cargo: '', email: '', telefono: '',
  es_principal: false, entidad_id: ''
}

export default function ContactosPage() {
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<Contacto | null>(null)
  const [form, setForm] = useState(formInicial)

  useEffect(() => {
    cargarContactos()
    cargarEntidades()
  }, [])

  async function cargarContactos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contactos')
      .select('*, entidades(razon_social, nombre_comercial)')
      .order('nombre')
    if (!error && data) setContactos(data)
    setLoading(false)
  }

  async function cargarEntidades() {
    const { data } = await supabase
      .from('entidades')
      .select('id, razon_social, nombre_comercial')
      .order('razon_social')
    if (data) setEntidades(data)
  }

  function nombreEntidad(c: Contacto) {
    return c.entidades?.nombre_comercial || c.entidades?.razon_social || '—'
  }

  function abrirEditar(c: Contacto) {
    setEditando(c)
    setForm({
      nombre: c.nombre,
      cargo: c.cargo || '',
      email: c.email || '',
      telefono: c.telefono || '',
      es_principal: c.es_principal,
      entidad_id: c.entidad_id
    })
    setMostrarForm(true)
  }

 async function guardar() {
    if (!form.nombre) return alert('El nombre es obligatorio')
    if (!form.entidad_id) return alert('Debes seleccionar una entidad')

    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()

    if (editando) {
      const { error } = await supabase.from('contactos').update({
        ...form,
        updated_by: user?.email,
        updated_at: ahora
      }).eq('id', editando.id)
      if (error) return alert('Error: ' + error.message)
    } else {
      const { error } = await supabase.from('contactos').insert([{
        ...form,
        created_by: user?.email,
        updated_by: user?.email,
        updated_at: ahora
      }])
      if (error) return alert('Error: ' + error.message)
    }

    setMostrarForm(false)
    setEditando(null)
    setForm(formInicial)
    cargarContactos()
  }

  const contactosFiltrados = contactos.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.cargo || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    nombreEntidad(c).toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Contactos</h1>
            <p className="text-sm text-gray-500">{contactos.length} registros</p>
          </div>
          <button onClick={() => { setEditando(null); setForm(formInicial); setMostrarForm(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            + Nuevo
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, email, cargo o entidad..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : contactosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No hay contactos aún</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Nombre', 'Cargo', 'Email', 'Teléfono', 'Entidad', 'Principal', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contactosFiltrados.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{c.cargo || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.telefono || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{nombreEntidad(c)}</td>
                    <td className="px-4 py-3">
                      {c.es_principal && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Principal</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => abrirEditar(c)}
                        className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50 cursor-pointer transition-colors">
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
                <h2 className="text-lg font-semibold">{editando ? 'Editar' : 'Nuevo'} contacto</h2>
                <button onClick={() => { setMostrarForm(false); setEditando(null); setForm(formInicial) }}
                  className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Entidad *</label>
                  <select value={form.entidad_id} onChange={e => setForm({ ...form, entidad_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">— seleccione entidad —</option>
                    {entidades.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.nombre_comercial || e.razon_social}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Cargo</label>
                  <input value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
                  <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" id="principal" checked={form.es_principal}
                    onChange={e => setForm({ ...form, es_principal: e.target.checked })} />
                  <label htmlFor="principal" className="text-sm cursor-pointer">Contacto principal</label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setMostrarForm(false); setEditando(null); setForm(formInicial) }}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                <button onClick={guardar}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editando ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
