#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Abre la búsqueda de GPC y otros enlaces en el navegador predeterminado.
        .plugin(tauri_plugin_opener::init())
        // Recordatorios de Windows (flashcards del día, refuerzo, pendientes del turno).
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Quirón Codex");
}
