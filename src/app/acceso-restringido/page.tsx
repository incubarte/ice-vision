
"use client";

import React, { useEffect, useState } from 'react';
import { ShieldAlert, AlertCircle, Lock } from 'lucide-react';

export default function RestrictedAccessPage() {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 selection:bg-red-500/30">
            <div className="relative w-full max-w-lg">
                {/* Abstract background elements */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl"></div>

                <div className="relative bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-8 md:p-12 rounded-[2.5rem] shadow-2xl text-center overflow-hidden">
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-400 to-red-600 opacity-50"></div>

                    <div className="flex justify-center mb-10">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-600 opacity-20 blur-2xl rounded-full animate-pulse"></div>
                            <div className="relative bg-red-950/30 border border-red-500/30 p-6 rounded-3xl">
                                <ShieldAlert className="w-14 h-14 text-red-500" />
                            </div>
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                        Acceso Bloqueado por Seguridad
                    </h1>

                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full mb-10">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-bold text-red-400 uppercase tracking-[0.15em]">Sitio no seguro detectado</span>
                    </div>

                    <div className="space-y-6">
                        <p className="text-slate-300 leading-relaxed text-lg font-medium">
                            Hemos detectado que el sitio desde el cual proviene este pedido <span className="text-red-400 font-bold underline decoration-red-500/30 underline-offset-4">no es seguro</span>.
                        </p>

                        <p className="text-slate-400 leading-relaxed text-base">
                            Por medidas de seguridad y para proteger la integridad de los datos, el acceso ha sido bloqueado automáticamente por nuestro sistema de protección de red.
                        </p>
                    </div>

                    <div className="mt-12 pt-8 border-t border-white/5">
                        <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-widest">
                            <Lock className="w-3 h-3" />
                            Studio Platform Framework v2
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
