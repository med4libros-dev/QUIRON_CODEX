// En Windows, sin ventana de consola detrás de la app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    quiron_codex_lib::run()
}
