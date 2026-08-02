<!doctype html>
<html lang="nl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? config('app.name') }}</title>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    <header class="app-header">
        <h1>{{ config('app.name') }}</h1>
        <nav class="nav-primary">
            <a href="{{ route('home') }}" @class(['nav-item', 'active' => request()->routeIs('home')])>Home</a>
        </nav>
        <div class="user-chip">
            {{ Auth::user()->name }}
            <form method="post" action="{{ route('auth.logout') }}">
                @csrf
                <button type="submit" class="btn btn-sm">Uitloggen</button>
            </form>
        </div>
    </header>

    <main>
        @if (session('success'))
            <div class="flash flash-success">{{ session('success') }}</div>
        @endif
        @if (session('error'))
            <div class="flash flash-error">{{ session('error') }}</div>
        @endif
        @yield('content')
    </main>
</body>
</html>
