use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// Los widgets son ventanas aparte de la principal: pequeñas, sin barra del sistema y
/// siempre encima. Cada una carga la misma página con «?widget=<tipo>».
const PREFIX: &str = "widget-";

fn label_of(kind: &str) -> String {
    format!("{PREFIX}{kind}")
}

/// Abre un widget (o lo trae al frente si ya estaba abierto).
#[tauri::command]
fn open_widget(app: AppHandle, kind: String, width: f64, height: f64) -> Result<(), String> {
    let label = label_of(&kind);
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html?widget={kind}").into()),
    )
    .title("Quirón Codex")
    .inner_size(width, height)
    .min_inner_size(220.0, 120.0)
    .always_on_top(true)
    .decorations(false)
    .skip_taskbar(true)
    .resizable(true)
    .shadow(true)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_widget(app: AppHandle, kind: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(&label_of(&kind)) {
        w.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Qué widgets están abiertos ahora mismo.
#[tauri::command]
fn list_widgets(app: AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .filter_map(|l| l.strip_prefix(PREFIX).map(|k| k.to_string()))
        .collect()
}

/// Cierra la ventana desde la que se llama (el ✕ del widget).
#[tauri::command]
fn close_self(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// Abre o cierra un widget: lo usan los atajos del sistema.
fn toggle_widget(app: &AppHandle, kind: &str, width: f64, height: f64) {
    let label = label_of(kind);
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.close();
    } else {
        let _ = open_widget(app.clone(), kind.to_string(), width, height);
    }
}

/// Trae la ventana principal al frente y le pide abrir la búsqueda.
fn focus_main(app: &AppHandle, event: &str) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        let _ = app.emit_to("main", event, ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Abre la búsqueda de GPC y otros enlaces en el navegador predeterminado.
        .plugin(tauri_plugin_opener::init())
        // Recordatorios de Windows (flashcards del día, refuerzo, pendientes del turno).
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            open_widget,
            close_widget,
            list_widgets,
            close_self
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

                // Atajos fijos, con Ctrl+Alt para no pisar los de Windows.
                let capture = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyQ);
                let search = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyK);
                let glance = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyG);

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcuts([capture, search, glance])?
                        .with_handler(move |app, shortcut, event| {
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }
                            if shortcut == &capture {
                                toggle_widget(app, "capture", 380.0, 300.0);
                            } else if shortcut == &search {
                                focus_main(app, "qc://search");
                            } else if shortcut == &glance {
                                toggle_widget(app, "glance", 320.0, 190.0);
                            }
                        })
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Quirón Codex");
}
