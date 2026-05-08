'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from './context/empresa'

export default function Navbar() {
  const { empresaActual, empresas, setEmpresaActual } = useEmpresa()
  const [mostrarEmpresas, setMostrarEmpresas] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  async function cerrarSesion() {
    await supabase.auth.signOut()
    localStorage.removeItem('empresa_actual')
    window.location.href = '/login'
  }

  function cambiarEmpresa(empresa: any) {
    setEmpresaActual(empresa)
    setMostrarEmpresas(false)
  }

  const navItems = [
    { label: 'Clientes / Proveed.', href: '/entidades' },
    { label: 'Bienes y Servicios', href: '/bienes' },
  ]

  if (pathname === '/login' || pathname === '/seleccionar-empresa') return null

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <span className="font-bold text-gray-800 text-lg">FINDOS</span>
        <div className="flex gap-1">
          {navItems.map(item => (
            <a key={item.href} href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${pathname === item.href ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button onClick={() => setMostrarEmpresas(!mostrarEmpresas)}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <span className="font-medium">{empresaActual?.nombre_comercial || empresaActual?.nombre || 'Seleccionar empresa'}</span>
            <span className="text-gray-400">▼</span>
          </button>
          {mostrarEmpresas && (
            <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-100 rounded-xl shadow-lg z-50">
              <div className="p-2">
                <p className="text-xs text-gray-400 px-2 py-1 mb-1">Cambiar empresa</p>
                {empresas.map(empresa => (
                  <button key={empresa.id} onClick={() => cambiarEmpresa(empresa)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${empresaActual?.id === empresa.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <div className="font-medium">{empresa.nombre_comercial || empresa.nombre}</div>
                    <div className="text-xs text-gray-400 font-mono">{empresa.rut}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={cerrarSesion}
          className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 cursor-pointer transition-colors">
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}