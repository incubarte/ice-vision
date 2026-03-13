"use client";

import React from 'react';
import { ShieldAlert, AlertCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function RestrictedAccessPage() {
    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 selection:bg-red-500/30">
            <div className="relative w-full max-w-lg">
                {/* Abstract background elements */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"></div>

                <div className="relative bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-3xl shadow-2xl text-center overflow-hidden">
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>

                    <div className="flex justify-center mb-8">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-500 opacity-20 blur-xl rounded-full"></div>
                            <div className="relative bg-red-500/10 border border-red-500/50 p-5 rounded-2xl">
                                <ShieldAlert className="w-12 h-12 text-red-500" />
                            </div>
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
                        Acceso no autorizado
                    </h1>

                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Error: Referral Blocked</span>
                    </div>

                    <p className="text-slate-400 leading-relaxed mb-8 text-lg">
                        Lo sentimos, pero el acceso a este sistema de puntuación no está permitido desde el origen solicitado.
                        Por favor, asegúrate de ingresar directamente a la plataforma oficial.
                    </p>

                    <div className="space-y-4">
                        <Button asChild size="lg" className="w-full h-12 bg-white text-slate-900 hover:bg-slate-200 font-bold transition-all duration-300">
                            <Link href="/">
                                <Home className="w-4 h-4 mr-2" />
                                Ir al Inicio
                            </Link>
                        </Button>

                        <p className="text-slate-500 text-sm">
                            Si crees que esto es un error, por favor contacta al administrador del sistema.
                        </p>
                    </div>

                    {/* Subtle decoration */}
                    <div className="mt-12 text-[10px] text-slate-700 uppercase tracking-[0.2em] font-medium">
                        ScoreBoard Studio Platform Integrity
                    </div>
                </div>
            </div>
        </div>
    );
}
