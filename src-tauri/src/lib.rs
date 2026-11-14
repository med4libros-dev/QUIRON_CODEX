#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Abre NotebookLM, la búsqueda de GPC y otros enlaces en el navegador predeterminado.
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Quirón Codex");
}
