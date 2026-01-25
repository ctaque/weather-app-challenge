use anyhow::{Context, Result};
use tracing::info;

#[derive(Debug, Clone)]
pub struct ParsedWindData {
    pub lat_values: Vec<f64>,
    pub lon_values: Vec<f64>,
    pub u_data: Vec<f64>,
    pub v_data: Vec<f64>,
}

#[derive(Debug, Clone)]
pub struct ParsedPrecipitationData {
    pub lat_values: Vec<f64>,
    pub lon_values: Vec<f64>,
    pub prate_data: Vec<f64>,
}

/// Parse OpenDAP ASCII response for wind data
pub fn parse_opendap_ascii(ascii_data: &str) -> Result<ParsedWindData> {
    let lines: Vec<&str> = ascii_data.lines().collect();

    let mut lat_values = Vec::new();
    let mut lon_values = Vec::new();
    let mut u_values = Vec::new();
    let mut v_values = Vec::new();

    let mut current_variable: Option<&str> = None;
    let mut in_data_section = false;

    // Track which variables we've already parsed (lat/lon appear multiple times)
    let mut parsed_lat = false;
    let mut parsed_lon = false;
    let mut parsed_ugrd = false;
    let mut parsed_vgrd = false;

    for line in lines {
        let trimmed = line.trim();

        // Detect variable declarations
        if trimmed.starts_with("lat,") || trimmed.starts_with("lat[") {
            if !parsed_lat {
                current_variable = Some("lat");
                in_data_section = true;
                parsed_lat = true;
            } else {
                current_variable = None;
                in_data_section = false;
            }
            continue;
        }

        if trimmed.starts_with("lon,") || trimmed.starts_with("lon[") {
            if !parsed_lon {
                current_variable = Some("lon");
                in_data_section = true;
                parsed_lon = true;
            } else {
                current_variable = None;
                in_data_section = false;
            }
            continue;
        }

        if trimmed.starts_with("ugrd10m,") {
            if !parsed_ugrd {
                current_variable = Some("ugrd");
                in_data_section = false; // For 3D arrays, wait for [index] lines
                parsed_ugrd = true;
            } else {
                current_variable = None;
                in_data_section = false;
            }
            continue;
        }

        if trimmed.starts_with("vgrd10m,") {
            if !parsed_vgrd {
                current_variable = Some("vgrd");
                in_data_section = false; // For 3D arrays, wait for [index] lines
                parsed_vgrd = true;
            } else {
                current_variable = None;
                in_data_section = false;
            }
            continue;
        }

        // Skip time variable
        if trimmed.starts_with("time,") || trimmed.starts_with("time[") {
            current_variable = None;
            in_data_section = false;
            continue;
        }

        // Skip empty lines
        if trimmed.is_empty() {
            continue;
        }

        // For wind data: lines start with [index][index]
        if trimmed.starts_with('[') {
            in_data_section = true;
            // Extract numbers from this line
            let nums = extract_numbers_from_indexed_line(trimmed);

            match current_variable {
                Some("ugrd") => u_values.extend(nums),
                Some("vgrd") => v_values.extend(nums),
                _ => {}
            }
            continue;
        }

        // Data line with only numbers (for lat/lon and continuation lines)
        if in_data_section && !trimmed.chars().next().map_or(false, |c| c.is_alphabetic()) {
            let nums = extract_numbers(trimmed);

            match current_variable {
                Some("lat") => lat_values.extend(nums),
                Some("lon") => lon_values.extend(nums),
                Some("ugrd") => u_values.extend(nums),
                Some("vgrd") => v_values.extend(nums),
                _ => {}
            }
        }
    }

    info!(
        "Parsed: {} lats, {} lons, {} U values, {} V values",
        lat_values.len(),
        lon_values.len(),
        u_values.len(),
        v_values.len()
    );

    // Safety check
    if lat_values.is_empty() || lon_values.is_empty() || u_values.is_empty() || v_values.is_empty() {
        anyhow::bail!(
            "Invalid parsed data: lats={}, lons={}, uValues={}, vValues={}",
            lat_values.len(),
            lon_values.len(),
            u_values.len(),
            v_values.len()
        );
    }

    Ok(ParsedWindData {
        lat_values,
        lon_values,
        u_data: u_values,
        v_data: v_values,
    })
}

/// Parse OpenDAP ASCII response for precipitation data
pub fn parse_opendap_precipitation_ascii(ascii_data: &str) -> Result<ParsedPrecipitationData> {
    let lines: Vec<&str> = ascii_data.lines().collect();

    let mut lat_values = Vec::new();
    let mut lon_values = Vec::new();
    let mut prate_values = Vec::new();

    let mut current_variable: Option<&str> = None;
    let mut in_data_section = false;

    let mut parsed_lat = false;
    let mut parsed_lon = false;
    let mut parsed_prate = false;

    for line in lines {
        let trimmed = line.trim();

        // Detect variable declarations
        if trimmed.starts_with("lat,") || trimmed.starts_with("lat[") {
            if !parsed_lat {
                current_variable = Some("lat");
                in_data_section = true;
                parsed_lat = true;
            } else {
                current_variable = None;
                in_data_section = false;
            }
            continue;
        }

        if trimmed.starts_with("lon,") || trimmed.starts_with("lon[") {
            if !parsed_lon {
                current_variable = Some("lon");
                in_data_section = true;
                parsed_lon = true;
            } else {
                current_variable = None;
                in_data_section = false;
            }
            continue;
        }

        if trimmed.starts_with("pratesfc,") {
            if !parsed_prate {
                current_variable = Some("prate");
                in_data_section = false; // For 3D arrays, wait for [index] lines
                parsed_prate = true;
            } else {
                current_variable = None;
                in_data_section = false;
            }
            continue;
        }

        // Skip time variable
        if trimmed.starts_with("time,") || trimmed.starts_with("time[") {
            current_variable = None;
            in_data_section = false;
            continue;
        }

        // Skip empty lines
        if trimmed.is_empty() {
            continue;
        }

        // For precipitation data: lines start with [index][index]
        if trimmed.starts_with('[') {
            in_data_section = true;
            let nums = extract_numbers_from_indexed_line(trimmed);

            if matches!(current_variable, Some("prate")) {
                prate_values.extend(nums);
            }
            continue;
        }

        // Data line with only numbers
        if in_data_section && !trimmed.chars().next().map_or(false, |c| c.is_alphabetic()) {
            let nums = extract_numbers(trimmed);

            match current_variable {
                Some("lat") => lat_values.extend(nums),
                Some("lon") => lon_values.extend(nums),
                Some("prate") => prate_values.extend(nums),
                _ => {}
            }
        }
    }

    info!(
        "Parsed precipitation: {} lats, {} lons, {} prate values",
        lat_values.len(),
        lon_values.len(),
        prate_values.len()
    );

    if lat_values.is_empty() || lon_values.is_empty() || prate_values.is_empty() {
        anyhow::bail!(
            "Invalid parsed precipitation data: lats={}, lons={}, prateValues={}",
            lat_values.len(),
            lon_values.len(),
            prate_values.len()
        );
    }

    Ok(ParsedPrecipitationData {
        lat_values,
        lon_values,
        prate_data: prate_values,
    })
}

/// Extract numbers from a line starting with [index][index]
fn extract_numbers_from_indexed_line(line: &str) -> Vec<f64> {
    // Remove the [index][index] prefix and extract numbers
    let without_prefix = line
        .split_once(']')
        .and_then(|(_, rest)| rest.trim_start_matches(',').trim().split_once(']'))
        .map(|(_, rest)| rest.trim_start_matches(',').trim())
        .unwrap_or(line);

    extract_numbers(without_prefix)
}

/// Extract floating point numbers from a string
fn extract_numbers(text: &str) -> Vec<f64> {
    text.split(|c: char| c == ',' || c.is_whitespace())
        .filter_map(|s| {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                trimmed.parse::<f64>().ok()
            } else {
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_numbers() {
        let nums = extract_numbers("1.5, 2.3, 3.7");
        assert_eq!(nums, vec![1.5, 2.3, 3.7]);

        let nums = extract_numbers("  4.2   5.1  ");
        assert_eq!(nums, vec![4.2, 5.1]);
    }

    #[test]
    fn test_extract_numbers_from_indexed_line() {
        let nums = extract_numbers_from_indexed_line("[0][0], 17.16, 17.22, 17.28");
        assert_eq!(nums, vec![17.16, 17.22, 17.28]);
    }
}
