use anyhow::Result;
use image::{ImageBuffer, Rgba, RgbaImage};
use tracing::info;

pub struct WindPngData {
    pub png_buffer: Vec<u8>,
    pub width: usize,
    pub height: usize,
    pub u_min: f64,
    pub u_max: f64,
    pub v_min: f64,
    pub v_max: f64,
}

/// Convert wind data to PNG for windgl
pub fn convert_to_png(
    width: usize,
    height: usize,
    u_data: &[f64],
    v_data: &[f64],
    u_min: f64,
    u_max: f64,
    v_min: f64,
    v_max: f64,
) -> Result<WindPngData> {
    info!("Creating {}x{} PNG...", width, height);

    // Create RGBA image
    let mut img: RgbaImage = ImageBuffer::new(width as u32, height as u32);

    for i in 0..u_data.len() {
        let x = (i % width) as u32;
        let y = (i / width) as u32;

        // Normalize U and V to 0-255
        let u_norm = ((u_data[i] - u_min) / (u_max - u_min) * 255.0).round() as u8;
        let v_norm = ((v_data[i] - v_min) / (v_max - v_min) * 255.0).round() as u8;

        img.put_pixel(x, y, Rgba([u_norm, v_norm, 0, 255]));
    }

    // Encode to PNG
    let mut png_buffer = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_buffer);

    img.write_with_encoder(encoder)?;

    info!("PNG created: {} bytes", png_buffer.len());

    Ok(WindPngData {
        png_buffer,
        width,
        height,
        u_min,
        u_max,
        v_min,
        v_max,
    })
}
